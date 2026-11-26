import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import {
  COLORS,
  COUNTDOWN_MS,
  MAX_PLAYERS,
  RECONNECT_GRACE_MS,
  SNAPSHOT_MS,
  TICK_MS,
  createRun,
  setPlayerInput,
  stepGame,
} from '@fighterjet/shared';
import type {
  GameEvent,
  GameState,
  Phase,
  PlayerId,
  PlayerInput,
  ServerMessage,
  Snapshot,
  TopScore,
} from '@fighterjet/shared';

export interface GameRoomOptions {
  countdownMs?: number;
  reconnectMs?: number;
  snapshotMs?: number;
  now?: () => number;
}

interface PlayerSlot {
  id: PlayerId;
  slot: 1 | 2;
  token: string;
  ws: WebSocket | null;
  connected: boolean;
  ready: boolean;
}

export type JoinResult =
  | { ok: true; playerId: PlayerId }
  | { ok: false; reason: 'full' };

export class GameRoom {
  private slots: Array<PlayerSlot | null> = [null, null];
  private game: GameState = createRun();
  private phase: Phase = 'waiting';
  private phaseBeforePause: 'playing' | 'countdown' = 'playing';
  private countdownEndsAt = 0;
  private countdownRemainingMs = 0;
  private pausedUntil = 0;
  private lastTick: number;
  private accumulator = 0;
  private snapshotAccumulator = 0;
  private pendingEvents: GameEvent[] = [];
  private topScores: TopScore[] = [];
  private readonly countdownMs: number;
  private readonly reconnectMs: number;
  private readonly snapshotMs: number;
  private readonly now: () => number;
  private readonly timer: NodeJS.Timeout;

  constructor(options: GameRoomOptions = {}) {
    this.countdownMs = options.countdownMs ?? COUNTDOWN_MS;
    this.reconnectMs = options.reconnectMs ?? RECONNECT_GRACE_MS;
    this.snapshotMs = options.snapshotMs ?? SNAPSHOT_MS;
    this.now = options.now ?? (() => Date.now());
    this.lastTick = this.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  join(ws: WebSocket, token: string | null): JoinResult {
    const reconnectIndex = token
      ? this.slots.findIndex((slot) => slot?.token === token)
      : -1;

    if (reconnectIndex >= 0) {
      const slot = this.slots[reconnectIndex];
      if (!slot) {
        return this.assignSlot(ws);
      }

      if (slot.ws && slot.ws !== ws && slot.ws.readyState === WebSocket.OPEN) {
        slot.ws.close();
      }

      slot.ws = ws;
      slot.connected = true;
      this.sendWelcome(ws, slot);

      if (this.phase === 'paused') {
        this.tryResume();
      } else if (
        this.phase === 'waiting' &&
        this.connectedCount() === MAX_PLAYERS
      ) {
        this.startCountdown();
      } else {
        this.sendSnapshot(ws);
      }

      return { ok: true, playerId: slot.id };
    }

    return this.assignSlot(ws);
  }

  private assignSlot(ws: WebSocket): JoinResult {
    const freeIndex = this.slots.findIndex((slot) => slot === null);
    if (freeIndex < 0) {
      return { ok: false, reason: 'full' };
    }

    const playerId: PlayerId = freeIndex === 0 ? 'p1' : 'p2';
    const slot: PlayerSlot = {
      id: playerId,
      slot: freeIndex === 0 ? 1 : 2,
      token: randomUUID(),
      ws,
      connected: true,
      ready: false,
    };

    this.slots[freeIndex] = slot;
    this.sendWelcome(ws, slot);

    if (
      this.phase === 'waiting' &&
      this.connectedCount() === MAX_PLAYERS
    ) {
      this.startCountdown();
    } else {
      this.sendSnapshot(ws);
    }

    return { ok: true, playerId };
  }

  disconnect(playerId: PlayerId, ws: WebSocket): void {
    const index = this.slots.findIndex((slot) => slot?.id === playerId);
    const slot = index >= 0 ? this.slots[index] : null;

    if (!slot || slot.ws !== ws) {
      return;
    }

    slot.connected = false;
    slot.ws = null;
    slot.ready = false;

    if (this.phase === 'playing' || this.phase === 'countdown') {
      this.pauseForDisconnect();
      return;
    }

    if (this.phase === 'paused') {
      if (this.connectedCount() === 0) {
        this.resetAll();
      } else {
        this.broadcastSnapshot();
      }
      return;
    }

    this.slots[index] = null;
    this.resetToWaiting();
  }

  handleInput(playerId: PlayerId, input: PlayerInput): void {
    if (this.phase !== 'playing' && this.phase !== 'countdown') {
      return;
    }

    const slot = this.slots.find((candidate) => candidate?.id === playerId);
    if (!slot?.connected) {
      return;
    }

    setPlayerInput(this.game, playerId, input);
  }

  handleReady(playerId: PlayerId): void {
    if (this.phase !== 'gameover') {
      return;
    }

    const slot = this.slots.find((candidate) => candidate?.id === playerId);
    if (!slot?.connected) {
      return;
    }

    slot.ready = true;
    this.broadcastSnapshot();

    const allReady = this.slots.every(
      (candidate) => candidate?.connected && candidate.ready,
    );

    if (allReady) {
      this.startCountdown();
    }
  }

  private sendWelcome(ws: WebSocket, slot: PlayerSlot): void {
    this.send(ws, {
      type: 'welcome',
      playerId: slot.id,
      token: slot.token,
      slot: slot.slot,
      color: slot.slot === 1 ? COLORS.p1 : COLORS.p2,
    });
  }

  private startCountdown(): void {
    this.game = createRun();
    this.phase = 'countdown';
    this.phaseBeforePause = 'countdown';
    this.countdownRemainingMs = 0;
    this.countdownEndsAt = this.now() + this.countdownMs;
    this.pausedUntil = 0;
    this.pendingEvents = [];
    this.accumulator = 0;
    this.snapshotAccumulator = 0;

    for (const slot of this.slots) {
      if (slot) {
        slot.ready = false;
      }
    }

    this.broadcastSnapshot();
  }

  private pauseForDisconnect(): void {
    const now = this.now();

    if (this.phase === 'countdown') {
      this.phaseBeforePause = 'countdown';
      this.countdownRemainingMs = Math.max(0, this.countdownEndsAt - now);
    } else {
      this.phaseBeforePause = 'playing';
    }

    this.phase = 'paused';
    this.pausedUntil = now + this.reconnectMs;
    this.broadcastSnapshot();
  }

  private tryResume(): void {
    if (this.phase !== 'paused' || this.connectedCount() < MAX_PLAYERS) {
      return;
    }

    this.phase = this.phaseBeforePause;
    if (this.phase === 'countdown') {
      this.countdownEndsAt = this.now() + this.countdownRemainingMs;
    }
    this.pausedUntil = 0;
    this.broadcastSnapshot();
  }

  private endRunAfterTimeout(): void {
    this.slots = this.slots.map((slot) =>
      slot?.connected ? slot : null,
    );
    if (this.connectedCount() === 0) {
      this.slots = [null, null];
    }
    this.resetToWaiting();
  }

  private resetToWaiting(): void {
    this.game = createRun();
    this.phase = 'waiting';
    this.phaseBeforePause = 'playing';
    this.countdownEndsAt = 0;
    this.countdownRemainingMs = 0;
    this.pausedUntil = 0;
    this.pendingEvents = [];
    this.accumulator = 0;

    for (const slot of this.slots) {
      if (slot) {
        slot.ready = false;
      }
    }

    this.broadcastSnapshot();

    if (this.connectedCount() === MAX_PLAYERS) {
      this.startCountdown();
    }
  }

  private resetAll(): void {
    this.slots = [null, null];
    this.resetToWaiting();
  }

  private tick(): void {
    const now = this.now();
    const delta = Math.min(250, Math.max(0, now - this.lastTick));
    this.lastTick = now;

    if (this.phase === 'countdown') {
      if (now >= this.countdownEndsAt) {
        this.phase = 'playing';
        this.phaseBeforePause = 'playing';
        this.broadcastSnapshot();
      }
    } else if (this.phase === 'paused') {
      if (this.connectedCount() === MAX_PLAYERS) {
        this.tryResume();
      } else if (now >= this.pausedUntil) {
        this.endRunAfterTimeout();
        return;
      }
    } else if (this.phase === 'playing') {
      this.accumulator += delta;

      while (this.accumulator >= TICK_MS) {
        stepGame(this.game, TICK_MS);
        this.accumulator -= TICK_MS;

        if (this.game.events.length > 0) {
          this.pendingEvents.push(...this.game.events);
          this.game.events.length = 0;
        }

        if (this.game.gameOver) {
          this.phase = 'gameover';
          this.recordTopScore();
          this.broadcastSnapshot();
          break;
        }
      }
    }

    this.snapshotAccumulator += delta;
    if (this.snapshotAccumulator >= this.snapshotMs) {
      this.snapshotAccumulator = 0;
      this.broadcastSnapshot();
    }
  }

  private recordTopScore(): void {
    if (this.game.score <= 0) {
      return;
    }

    this.topScores.push({ score: this.game.score, at: this.now() });
    this.topScores.sort((left, right) => right.score - left.score);
    this.topScores = this.topScores.slice(0, 10);
  }

  private connectedCount(): number {
    return this.slots.filter((slot) => slot?.connected).length;
  }

  private snapshot(includeEvents: boolean): Snapshot {
    const players = (['p1', 'p2'] as const).map((id) => {
      const player = this.game.players[id];
      const slot = this.slots.find((candidate) => candidate?.id === id);

      return {
        id,
        slot: player.slot,
        x: player.x,
        y: player.y,
        alive: player.alive,
        invincible: this.game.timeMs < player.invincibleUntil,
        connected: slot?.connected ?? false,
        weaponLevel: player.weaponLevel,
      };
    });

    const ready = this.slots
      .filter((slot): slot is PlayerSlot => Boolean(slot?.connected && slot.ready))
      .map((slot) => slot.id);

    return {
      serverTimeMs: this.game.timeMs,
      phase: this.phase,
      countdownRemainingMs:
        this.phase === 'countdown'
          ? Math.max(0, this.countdownEndsAt - this.now())
          : null,
      reconnectRemainingMs:
        this.phase === 'paused'
          ? Math.max(0, this.pausedUntil - this.now())
          : null,
      players,
      enemies: this.game.enemies.map((enemy) => ({
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        hp: enemy.hp,
      })),
      bullets: this.game.bullets.map((bullet) => ({
        id: bullet.id,
        owner: bullet.owner,
        x: bullet.x,
        y: bullet.y,
      })),
      score: this.game.score,
      lives: this.game.lives,
      wave: this.game.wave,
      ready,
      topScores: [...this.topScores],
      events: includeEvents ? [...this.pendingEvents] : [],
    };
  }

  private sendSnapshot(ws: WebSocket): void {
    this.send(ws, { type: 'snapshot', snapshot: this.snapshot(false) });
  }

  private broadcastSnapshot(): void {
    const snapshot = this.snapshot(true);
    const message: ServerMessage = { type: 'snapshot', snapshot };

    for (const slot of this.slots) {
      if (slot?.connected) {
        this.send(slot.ws, message);
      }
    }

    this.pendingEvents = [];
  }

  private send(ws: WebSocket | null, message: ServerMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
