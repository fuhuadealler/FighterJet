import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { parseClientMessage } from '@fighterjet/shared';
import type { ServerMessage } from '@fighterjet/shared';
import { GameRoom } from './room';

const DEFAULT_STATIC_DIR = path.resolve(
  fileURLToPath(new URL('../../client/dist', import.meta.url)),
);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

export interface ServerOptions {
  port?: number;
  host?: string;
  staticDir?: string | null;
  countdownMs?: number;
  reconnectMs?: number;
  snapshotMs?: number;
  now?: () => number;
}

export interface FighterJetServer {
  httpServer: ReturnType<typeof createServer>;
  room: GameRoom;
  listen(port?: number): Promise<number>;
  close(): Promise<void>;
}

async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  staticDir: string | null,
): Promise<void> {
  if (!staticDir) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  let pathname: string;
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const resolvedStatic = path.resolve(staticDir);
  const filePath = path.resolve(resolvedStatic, `.${pathname}`);
  const relativePath = path.relative(resolvedStatic, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error('Not a file');
    }

    const data = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type':
        MIME_TYPES[extension] ?? 'application/octet-stream',
      'Cache-Control':
        pathname === '/index.html'
          ? 'no-cache'
          : 'public, max-age=31536000, immutable',
    });
    res.end(data);
    return;
  } catch {
    if (!path.extname(pathname)) {
      try {
        const html = await readFile(path.join(resolvedStatic, 'index.html'));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(html);
        return;
      } catch {
        // Fall through to 404.
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

export function createFighterJetServer(
  options: ServerOptions = {},
): FighterJetServer {
  const staticDir =
    options.staticDir === undefined ? DEFAULT_STATIC_DIR : options.staticDir;

  const httpServer = createServer((req, res) => {
    void serveStatic(req, res, staticDir);
  });

  const wss = new WebSocketServer({ noServer: true });
  const room = new GameRoom({
    countdownMs: options.countdownMs,
    reconnectMs: options.reconnectMs,
    snapshotMs: options.snapshotMs,
    now: options.now,
  });

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    let token: string | null = null;
    try {
      token = new URL(req.url ?? '/', 'http://localhost').searchParams.get(
        'token',
      );
    } catch {
      token = null;
    }

    const joined = room.join(ws, token);

    if (!joined.ok) {
      const message: ServerMessage = { type: 'full' };
      ws.send(JSON.stringify(message));
      ws.close();
      return;
    }

    const playerId = joined.playerId;

    ws.on('message', (data) => {
      const message = parseClientMessage(data.toString());
      if (!message) {
        return;
      }

      if (message.type === 'input') {
        room.handleInput(playerId, message.input);
      } else if (message.type === 'ready') {
        room.handleReady(playerId);
      }
    });

    ws.on('close', () => room.disconnect(playerId, ws));
    ws.on('error', () => room.disconnect(playerId, ws));
  });

  return {
    httpServer,
    room,
    listen(port = options.port ?? 3001): Promise<number> {
      return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
          httpServer.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          httpServer.off('error', onError);
          const address = httpServer.address();
          resolve(
            typeof address === 'object' && address ? address.port : port,
          );
        };

        httpServer.once('error', onError);
        httpServer.once('listening', onListening);
        httpServer.listen(port, options.host ?? '0.0.0.0');
      });
    },
    close(): Promise<void> {
      room.dispose();
      for (const client of wss.clients) {
        client.terminate();
      }

      return new Promise((resolve, reject) => {
        wss.close((wsError) => {
          httpServer.close((httpError) => {
            if (wsError) {
              reject(wsError);
              return;
            }

            if (
              httpError &&
              (httpError as NodeJS.ErrnoException).code !==
                'ERR_SERVER_NOT_RUNNING'
            ) {
              reject(httpError);
              return;
            }

            resolve();
          });
        });
      });
    },
  };
}
