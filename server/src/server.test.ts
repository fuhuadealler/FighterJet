import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ServerMessage } from '@fighterjet/shared';
import { createFighterJetServer } from './server';
import type { FighterJetServer } from './server';

interface TestClient {
  ws: WebSocket;
  messages: ServerMessage[];
  waitFor(
    predicate: (message: ServerMessage) => boolean,
    timeoutMs?: number,
  ): Promise<ServerMessage>;
}

function connect(port: number, token?: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`,
    );
    const messages: ServerMessage[] = [];
    const listeners = new Set<(message: ServerMessage) => void>();

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      messages.push(message);
      for (const listener of [...listeners]) {
        listener(message);
      }
    });

    ws.on('error', reject);

    ws.on('open', () => {
      const client: TestClient = {
        ws,
        messages,
        waitFor(predicate, timeoutMs = 3000) {
          return new Promise((resolveWait, rejectWait) => {
            const existing = messages.find(predicate);
            if (existing) {
              resolveWait(existing);
              return;
            }

            let listener: (message: ServerMessage) => void = () => {};
            const timer = setTimeout(() => {
              listeners.delete(listener);
              rejectWait(new Error('Timed out waiting for message'));
            }, timeoutMs);

            listener = (message) => {
              if (!predicate(message)) {
                return;
              }
              clearTimeout(timer);
              listeners.delete(listener);
              resolveWait(message);
            };

            listeners.add(listener);

            const raced = messages.find(predicate);
            if (raced) {
              clearTimeout(timer);
              listeners.delete(listener);
              resolveWait(raced);
            }
          });
        },
      };

      resolve(client);
    });
  });
}

describe('FighterJet server', () => {
  let server: FighterJetServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('accepts two players, rejects a third, and applies authoritative movement', async () => {
    server = createFighterJetServer({
      port: 0,
      staticDir: null,
      countdownMs: 150,
      reconnectMs: 500,
      snapshotMs: 20,
    });

    const port = await server.listen(0);
    const first = await connect(port);
    const welcomeFirst = await first.waitFor(
      (message) => message.type === 'welcome',
    );
    expect(welcomeFirst.type).toBe('welcome');
    if (welcomeFirst.type !== 'welcome') {
      throw new Error('Expected welcome for first player');
    }
    expect(welcomeFirst.playerId).toBe('p1');

    const second = await connect(port);
    const welcomeSecond = await second.waitFor(
      (message) => message.type === 'welcome',
    );
    expect(welcomeSecond.type).toBe('welcome');
    if (welcomeSecond.type !== 'welcome') {
      throw new Error('Expected welcome for second player');
    }
    expect(welcomeSecond.playerId).toBe('p2');

    const third = await connect(port);
    const full = await third.waitFor((message) => message.type === 'full');
    expect(full.type).toBe('full');

    const playing = await second.waitFor(
      (message) =>
        message.type === 'snapshot' && message.snapshot.phase === 'playing',
      3000,
    );
    expect(playing.type).toBe('snapshot');
    if (playing.type !== 'snapshot') {
      throw new Error('Expected a playing snapshot');
    }

    const p1Before = playing.snapshot.players.find(
      (player) => player.id === 'p1',
    );
    expect(p1Before).toBeDefined();
    const beforeX = p1Before?.x ?? 0;

    first.ws.send(
      JSON.stringify({
        type: 'input',
        input: {
          up: false,
          down: false,
          left: false,
          right: true,
        },
      }),
    );

    const moved = await first.waitFor(
      (message) =>
        message.type === 'snapshot' &&
        message.snapshot.phase === 'playing' &&
        (message.snapshot.players.find((player) => player.id === 'p1')?.x ??
          0) > beforeX,
      3000,
    );
    expect(moved.type).toBe('snapshot');

    first.ws.close();
    second.ws.close();
    third.ws.close();
  }, 10000);

  it('pauses when a player disconnects and resumes with the session token', async () => {
    server = createFighterJetServer({
      port: 0,
      staticDir: null,
      countdownMs: 100,
      reconnectMs: 1000,
      snapshotMs: 20,
    });

    const port = await server.listen(0);
    const first = await connect(port);
    const welcomeFirst = await first.waitFor(
      (message) => message.type === 'welcome',
    );
    if (welcomeFirst.type !== 'welcome') {
      throw new Error('Expected welcome for first player');
    }

    const second = await connect(port);
    await second.waitFor((message) => message.type === 'welcome');
    await second.waitFor(
      (message) =>
        message.type === 'snapshot' && message.snapshot.phase === 'playing',
      3000,
    );

    first.ws.close();

    const paused = await second.waitFor(
      (message) =>
        message.type === 'snapshot' && message.snapshot.phase === 'paused',
      3000,
    );
    expect(paused.type).toBe('snapshot');

    const reconnected = await connect(port, welcomeFirst.token);
    await reconnected.waitFor((message) => message.type === 'welcome');

    const resumed = await second.waitFor(
      (message) =>
        message.type === 'snapshot' && message.snapshot.phase === 'playing',
      3000,
    );
    expect(resumed.type).toBe('snapshot');

    second.ws.close();
    reconnected.ws.close();
  }, 10000);
});
