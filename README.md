# FighterJet

English | [简体中文](README.zh-CN.md)

> Bros who fly together, fight together!

FighterJet is a browser-based, portrait (9:16) online co-op shoot 'em up for two players. Each player controls a jet from their own computer or phone, joining a single match run by an authoritative server. The two players share 3 lives and work together to score points against an endless stream of enemies.

This repository currently implements the **first playable thin slice**: online two-player connection, movement, auto-fire, one straight-flying enemy type, shared lives, scoring, game over, and a ready-up restart. Bosses, weapon upgrades, full waves, and music are planned for v1.0.

## Current features

- A single global match with at most 2 players; a third player sees a "match full" message.
- The match needs 2 players to start; a 3-second countdown begins once the second player joins.
- Authoritative server: clients send input, and the server runs the simulation on a 60Hz fixed timestep and broadcasts snapshots at 30Hz.
- 3 shared lives: each death costs 1 life, and the player respawns after 3 seconds with 2 seconds of invincibility. If both players die, each death costs a life.
- No friendly fire and no collisions between players.
- Auto-fire. Desktop uses WASD / arrow keys; mobile uses drag, with the jet drawn about 40px above the finger.
- One straight-flying enemy type, continuous spawning, scoring, and an in-memory Top 10 on the server.
- The match pauses on disconnect or when the app goes to the background, with a 30-second reconnect window. Reconnection uses a session token stored in the browser.
- After game over, each player readies up separately; once both are ready, a 3-second countdown restarts the match.
- Pixel-art Canvas rendering; 6 procedurally generated sound effects (4 are used in the current thin slice).
- A single Node service serves both the built client and the WebSocket on the same origin.

## Not yet implemented (v1.0)

- Two more enemy types, Zigzag and Shooter, for 3 in total.
- A full wave system (about 20–30 seconds per wave), with bosses on waves 5, 10, and 15.
- Three-phase bosses with bullet patterns.
- Weapon upgrade pickups and 3 weapon levels.
- Music, more sound effects, and richer visual feedback.
- Database-backed leaderboard, accounts, rooms/matchmaking, joining mid-match, dynamic difficulty, client-side prediction.

## Tech stack

- Client: React 19 + TypeScript + Canvas 2D, built with Vite.
- Server: Node.js + TypeScript + `ws`.
- Shared: `shared/` holds constants, the message protocol, types, and the fixed-timestep simulation.
- Workspace: npm workspaces (`client/`, `server/`, `shared/`).
- Tests: Vitest (shared logic unit tests + a server integration test with two WebSocket clients).

## Project structure

```text
FighterJet/
├── client/          # React UI + Canvas rendering + WebSocket client
│   └── src/game/    # input, interpolation, rendering, audio, connection
├── server/          # Node HTTP + WebSocket authoritative server
│   └── src/room.ts  # global match, reconnects, pausing, Top 10
├── shared/          # protocol, types, constants, simulation, unit tests
└── package.json     # npm workspaces and shared scripts
```

## Running locally

Requirements: Node.js 24+ (verified on Node 24.19) and npm.

```sh
npm install
npm run dev
```

Open <http://localhost:5173>. Open the same address in a second browser tab or on another device on the same LAN; the countdown starts automatically once the second player joins.

In development, Vite runs on port 5173 and the Node/WebSocket server runs on 3001; Vite proxies `/ws` to the server.

### LAN / mobile testing

`npm run dev` enables Vite's `host: true`. With your phone and computer on the same network, open the computer's LAN IP (for example `http://192.168.1.10:5173`). On mobile, the game automatically tries to request fullscreen and lock portrait orientation, and fails silently if the browser doesn't support it.

## Production build

```sh
npm run build
npm start
```

Open <http://localhost:3001>. In production, a single Node service serves both `client/dist` and `/ws`, so no CORS configuration is needed.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite client and the Node server together |
| `npm run dev:client` | Start only the Vite client |
| `npm run dev:server` | Start only the Node server (tsx watch) |
| `npm run build` | Build the client into `client/dist` |
| `npm start` | Start the production server |
| `npm test` | Run the shared unit tests and the server integration tests |
| `npm run typecheck` | Type-check all three workspaces |

## Controls

- Desktop: move with WASD or arrow keys; firing is automatic.
- Mobile: drag on the game screen to move; firing is automatic; the jet sits about 40px above your finger.
- There is no manual fire or pause button. Disconnecting or backgrounding the app pauses the match automatically and tries to reconnect.

## Known limitations

- There is only one global match, so only one pair of players can play at a time.
- The Top 10 lives in server memory and is cleared on restart; there are no accounts and no persistence.
- Reconnecting relies on the session token stored in the browser; after clearing storage you can't reclaim your seat.
- The current thin slice still spawns enemies continuously rather than using the full wave/boss system.
- Automated tests pass, but **a two-device playtest on real browsers or phones has not been done yet**; game feel and mobile layout still need real-world testing.
- No account system; it's meant for small games among friends.

## License

MIT
