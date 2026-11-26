export type PlayerId = 'p1' | 'p2';
export type PlayerSlot = 1 | 2;

export type Phase = 'waiting' | 'countdown' | 'playing' | 'paused' | 'gameover';

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  targetX?: number;
  targetY?: number;
}

export interface PlayerState {
  id: PlayerId;
  slot: PlayerSlot;
  x: number;
  y: number;
  alive: boolean;
  respawnAt: number;
  invincibleUntil: number;
  fireCooldownMs: number;
  weaponLevel: 1 | 2 | 3;
  input: PlayerInput;
}

export interface BulletState {
  id: number;
  owner: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface EnemyState {
  id: number;
  x: number;
  y: number;
  vy: number;
  hp: number;
}

export type GameEvent =
  | { type: 'player-shot'; playerId: PlayerId }
  | { type: 'enemy-hit'; x: number; y: number }
  | { type: 'enemy-killed'; x: number; y: number }
  | { type: 'player-died'; playerId: PlayerId }
  | { type: 'game-over' }
  | { type: 'pickup'; playerId: PlayerId }
  | { type: 'boss-warning' };

export interface GameState {
  timeMs: number;
  players: Record<PlayerId, PlayerState>;
  enemies: EnemyState[];
  bullets: BulletState[];
  score: number;
  lives: number;
  wave: number;
  nextEnemyAt: number;
  nextId: number;
  gameOver: boolean;
  events: GameEvent[];
}

export interface TopScore {
  score: number;
  at: number;
}

export interface PlayerSnapshot {
  id: PlayerId;
  slot: PlayerSlot;
  x: number;
  y: number;
  alive: boolean;
  invincible: boolean;
  connected: boolean;
  weaponLevel: 1 | 2 | 3;
}

export interface EnemySnapshot {
  id: number;
  x: number;
  y: number;
  hp: number;
}

export interface BulletSnapshot {
  id: number;
  owner: PlayerId;
  x: number;
  y: number;
}

export interface Snapshot {
  serverTimeMs: number;
  phase: Phase;
  countdownRemainingMs: number | null;
  reconnectRemainingMs: number | null;
  players: PlayerSnapshot[];
  enemies: EnemySnapshot[];
  bullets: BulletSnapshot[];
  score: number;
  lives: number;
  wave: number;
  ready: PlayerId[];
  topScores: TopScore[];
  events: GameEvent[];
}
