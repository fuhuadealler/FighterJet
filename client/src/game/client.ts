import {
  COLORS,
  INPUT_MS,
  INTERPOLATION_MS,
  type ClientMessage,
  type ServerMessage,
  type Snapshot,
} from '@fighterjet/shared';
import { SfxPlayer } from './audio';
import { InputController } from './input';
import { interpolateSnapshot } from './interpolate';
import { renderFrame } from './render';
import type { ClientStore } from './store';

const TOKEN_KEY = 'fighterjet.sessionToken';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export class FighterJetClient {
  private readonly store: ClientStore;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly input = new InputController();
  private readonly sfx = new SfxPlayer();

  private ws: WebSocket | null = null;
  private snapshots: Snapshot[] = [];
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private suspended = false;
  private reconnectTimer: number | null = null;
  private inputTimer: number | null = null;
  private animationFrame = 0;

  constructor(store: ClientStore, canvas: HTMLCanvasElement) {
    this.store = store;
    this.canvas = canvas;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas 2D context is unavailable');
    }
    this.context = context;

    this.input.attach(canvas);
    window.addEventListener('pointerdown', this.unlockAudio);
    window.addEventListener('keydown', this.unlockAudio);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.animationFrame = requestAnimationFrame(this.frame);
    this.inputTimer = window.setInterval(() => this.sendInput(), INPUT_MS);
    this.connect();
  }

  destroy(): void {
    this.shouldReconnect = false;
    this.suspended = true;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
    if (this.inputTimer !== null) {
      clearInterval(this.inputTimer);
      this.inputTimer = null;
    }
    this.clearReconnectTimer();

    window.removeEventListener('pointerdown', this.unlockAudio);
    window.removeEventListener('keydown', this.unlockAudio);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.destroy();

    const socket = this.ws;
    this.ws = null;
    socket?.close();
  }

  ready(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: ClientMessage = { type: 'ready' };
    this.ws.send(JSON.stringify(message));
  }

  retry(): void {
    this.shouldReconnect = true;
    if (this.store.getSnapshot().status === 'full') {
      clearToken();
    }

    const socket = this.ws;
    this.ws = null;
    socket?.close();
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.connect();
  }

  private connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.clearReconnectTimer();
    this.store.set({ status: 'connecting', error: null });

    const token = readToken();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws${
      token ? `?token=${encodeURIComponent(token)}` : ''
    }`;

    const socket = new WebSocket(url);
    this.ws = socket;

    socket.onmessage = (event) => {
      if (this.ws !== socket || typeof event.data !== 'string') {
        return;
      }
      this.handleMessage(event.data);
    };

    socket.onclose = () => {
      if (this.ws !== socket) {
        return;
      }

      this.ws = null;

      if (this.store.getSnapshot().status === 'full') {
        return;
      }

      this.store.set({ status: 'closed' });
      if (!this.suspended && this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      // The close event owns reconnect and error state.
    };
  }

  private handleMessage(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    if (message.type === 'welcome') {
      writeToken(message.token);
      this.reconnectAttempt = 0;
      this.snapshots = [];
      this.store.set({
        status: 'connected',
        playerId: message.playerId,
        snapshot: null,
        error: null,
      });
      return;
    }

    if (message.type === 'snapshot') {
      this.acceptSnapshot(message.snapshot);
      return;
    }

    if (message.type === 'full') {
      this.shouldReconnect = false;
      clearToken();
      this.store.set({
        status: 'full',
        snapshot: null,
        error: '当前对局已满，请稍后再试。',
      });
      return;
    }

    this.store.set({
      status: 'error',
      error: message.message,
    });
  }

  private acceptSnapshot(snapshot: Snapshot): void {
    const last = this.snapshots[this.snapshots.length - 1];

    if (
      last &&
      (snapshot.serverTimeMs < last.serverTimeMs ||
        (last.phase === 'gameover' && snapshot.phase === 'countdown'))
    ) {
      this.snapshots = [];
    }

    this.snapshots.push(snapshot);
    if (this.snapshots.length > 12) {
      this.snapshots.shift();
    }

    this.store.set({ snapshot });
    this.sfx.playEvents(snapshot.events);
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.suspended) {
      return;
    }

    const delay = Math.min(
      5000,
      500 * 2 ** Math.min(this.reconnectAttempt, 4),
    );
    this.reconnectAttempt += 1;
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private sendInput(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: ClientMessage = {
      type: 'input',
      input: this.input.getInput(),
    };
    this.ws.send(JSON.stringify(message));
  }

  private readonly frame = (): void => {
    this.animationFrame = requestAnimationFrame(this.frame);
    this.draw();
  };

  private draw(): void {
    const context = this.context;

    if (this.snapshots.length === 0) {
      context.fillStyle = COLORS.background;
      context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    const latest = this.snapshots[this.snapshots.length - 1];
    const target = latest.serverTimeMs - INTERPOLATION_MS;
    let frame = latest;

    if (this.snapshots.length > 1) {
      const oldest = this.snapshots[0];

      if (target <= oldest.serverTimeMs) {
        frame = oldest;
      } else if (target < latest.serverTimeMs) {
        for (let index = 0; index < this.snapshots.length - 1; index++) {
          const older = this.snapshots[index];
          const newer = this.snapshots[index + 1];

          if (
            older.serverTimeMs <= target &&
            target <= newer.serverTimeMs
          ) {
            const span = newer.serverTimeMs - older.serverTimeMs;
            const alpha =
              span > 0 ? (target - older.serverTimeMs) / span : 0;
            frame = interpolateSnapshot(older, newer, alpha);
            break;
          }
        }
      }
    }

    renderFrame(context, frame, performance.now());
  }

  private readonly unlockAudio = (): void => {
    this.sfx.unlock();
    this.requestImmersiveMode();
  };

  private requestImmersiveMode(): void {
    if (!window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    if (!document.fullscreenElement) {
      const requestFullscreen =
        document.documentElement.requestFullscreen;
      if (requestFullscreen) {
        void requestFullscreen.call(document.documentElement).catch(() => {
          // Fullscreen is best-effort on mobile browsers.
        });
      }
    }

    const orientation = screen.orientation as
      | (ScreenOrientation & {
          lock?: (value: 'portrait') => Promise<void>;
        })
      | undefined;
    if (orientation && typeof orientation.lock === 'function') {
      void orientation.lock('portrait').catch(() => {
        // Orientation lock is unsupported on some mobile browsers.
      });
    }
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      this.suspended = true;
      const socket = this.ws;
      this.ws = null;
      socket?.close();
      if (this.store.getSnapshot().status !== 'full') {
        this.store.set({ status: 'closed' });
      }
      return;
    }

    this.suspended = false;
    if (
      this.store.getSnapshot().status !== 'full' &&
      this.ws === null
    ) {
      this.connect();
    }
  };
}
