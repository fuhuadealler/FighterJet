import type { PlayerId } from './types';

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 640;
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const SNAPSHOT_RATE = 30;
export const SNAPSHOT_MS = 1000 / SNAPSHOT_RATE;
export const INPUT_RATE = 30;
export const INPUT_MS = 1000 / INPUT_RATE;
export const INTERPOLATION_MS = 100;

export const MAX_PLAYERS = 2;
export const SHARED_LIVES = 3;
export const RESPAWN_DELAY_MS = 3000;
export const INVINCIBILITY_MS = 2000;
export const COUNTDOWN_MS = 3000;
export const RECONNECT_GRACE_MS = 30000;

export const PLAYER_SPEED = 220;
export const PLAYER_HITBOX_RADIUS = 4;
export const PLAYER_START_Y = 580;
export const PLAYER_START_X: Record<PlayerId, number> = {
  p1: 120,
  p2: 240,
};

export const PLAYER_BOUNDS = {
  minX: 16,
  maxX: WORLD_WIDTH - 16,
  minY: 40,
  maxY: WORLD_HEIGHT - 24,
} as const;

export const FIRE_INTERVAL_MS = 1000 / 6;
export const BULLET_SPEED = 320;
export const BULLET_RADIUS = 2;

export const ENEMY_RADIUS = 10;
export const ENEMY_SPEED = 70;
export const ENEMY_HP = 1;
export const ENEMY_SCORE = 100;
export const ENEMY_SPAWN_START_MS = 1200;
export const ENEMY_SPAWN_MIN_MS = 500;
export const WAVE_DURATION_MS = 20000;

export const COLORS = {
  background: '#0B0F14',
  p1: '#F2F2F2',
  p2: '#4DD0E1',
  enemy: '#FF5252',
  enemyBullet: '#FF5252',
  playerBullet: '#FFD54F',
  pickup: '#AEEA00',
} as const;
