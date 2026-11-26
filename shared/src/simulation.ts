import {
  BULLET_RADIUS,
  BULLET_SPEED,
  ENEMY_HP,
  ENEMY_RADIUS,
  ENEMY_SCORE,
  ENEMY_SPAWN_MIN_MS,
  ENEMY_SPAWN_START_MS,
  ENEMY_SPEED,
  FIRE_INTERVAL_MS,
  INVINCIBILITY_MS,
  PLAYER_BOUNDS,
  PLAYER_HITBOX_RADIUS,
  PLAYER_SPEED,
  PLAYER_START_X,
  PLAYER_START_Y,
  RESPAWN_DELAY_MS,
  SHARED_LIVES,
  WAVE_DURATION_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import type {
  BulletState,
  EnemyState,
  GameState,
  PlayerId,
  PlayerInput,
  PlayerState,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceSq(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function createPlayer(id: PlayerId, slot: 1 | 2): PlayerState {
  return {
    id,
    slot,
    x: PLAYER_START_X[id],
    y: PLAYER_START_Y,
    alive: true,
    respawnAt: 0,
    invincibleUntil: 0,
    fireCooldownMs: 0,
    weaponLevel: 1,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
  };
}

export function createRun(): GameState {
  return {
    timeMs: 0,
    players: {
      p1: createPlayer('p1', 1),
      p2: createPlayer('p2', 2),
    },
    enemies: [],
    bullets: [],
    score: 0,
    lives: SHARED_LIVES,
    wave: 1,
    nextEnemyAt: 900,
    nextId: 1,
    gameOver: false,
    events: [],
  };
}

export function setPlayerInput(
  state: GameState,
  playerId: PlayerId,
  input: PlayerInput,
): void {
  state.players[playerId].input = input;
}

function spawnEnemy(state: GameState): void {
  const enemy: EnemyState = {
    id: state.nextId++,
    x: 20 + Math.random() * (WORLD_WIDTH - 40),
    y: -20,
    vy: ENEMY_SPEED,
    hp: ENEMY_HP,
  };
  state.enemies.push(enemy);
}

function spawnBullet(
  state: GameState,
  owner: PlayerId,
  x: number,
  y: number,
  vx: number,
): void {
  const bullet: BulletState = {
    id: state.nextId++,
    owner,
    x,
    y,
    vx,
    vy: -BULLET_SPEED,
  };
  state.bullets.push(bullet);
}

function firePlayer(state: GameState, player: PlayerState): void {
  const y = player.y - 14;

  if (player.weaponLevel === 1) {
    spawnBullet(state, player.id, player.x, y, 0);
  } else if (player.weaponLevel === 2) {
    spawnBullet(state, player.id, player.x - 5, y, 0);
    spawnBullet(state, player.id, player.x + 5, y, 0);
  } else {
    spawnBullet(state, player.id, player.x - 8, y, -55);
    spawnBullet(state, player.id, player.x, y, 0);
    spawnBullet(state, player.id, player.x + 8, y, 55);
  }

  state.events.push({ type: 'player-shot', playerId: player.id });
}

function movePlayer(player: PlayerState, dtMs: number): void {
  const input = player.input;
  let dx = 0;
  let dy = 0;

  if (
    typeof input.targetX === 'number' &&
    typeof input.targetY === 'number'
  ) {
    const targetX = clamp(
      input.targetX,
      PLAYER_BOUNDS.minX,
      PLAYER_BOUNDS.maxX,
    );
    const targetY = clamp(
      input.targetY,
      PLAYER_BOUNDS.minY,
      PLAYER_BOUNDS.maxY,
    );
    const deltaX = targetX - player.x;
    const deltaY = targetY - player.y;
    const length = Math.hypot(deltaX, deltaY);
    if (length > 1) {
      dx = deltaX / length;
      dy = deltaY / length;
    }
  } else {
    dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      dx /= length;
      dy /= length;
    }
  }

  const step = (PLAYER_SPEED * dtMs) / 1000;
  player.x = clamp(
    player.x + dx * step,
    PLAYER_BOUNDS.minX,
    PLAYER_BOUNDS.maxX,
  );
  player.y = clamp(
    player.y + dy * step,
    PLAYER_BOUNDS.minY,
    PLAYER_BOUNDS.maxY,
  );
}

function killPlayer(state: GameState, player: PlayerState): void {
  if (!player.alive) {
    return;
  }

  player.alive = false;
  player.respawnAt = state.timeMs + RESPAWN_DELAY_MS;
  state.lives = Math.max(0, state.lives - 1);
  state.events.push({ type: 'player-died', playerId: player.id });

  if (state.lives === 0) {
    state.gameOver = true;
    state.events.push({ type: 'game-over' });
  }
}

function respawnPlayer(state: GameState, player: PlayerState): void {
  player.alive = true;
  player.x = WORLD_WIDTH / 2;
  player.y = PLAYER_START_Y;
  player.invincibleUntil = state.timeMs + INVINCIBILITY_MS;
}

function spawnIntervalForWave(wave: number): number {
  return Math.max(
    ENEMY_SPAWN_MIN_MS,
    ENEMY_SPAWN_START_MS - (wave - 1) * 100,
  );
}

export function stepGame(state: GameState, dtMs: number): void {
  if (state.gameOver) {
    return;
  }

  state.timeMs += dtMs;
  state.wave = 1 + Math.floor(state.timeMs / WAVE_DURATION_MS);

  for (const player of Object.values(state.players)) {
    if (!player.alive) {
      if (state.lives > 0 && state.timeMs >= player.respawnAt) {
        respawnPlayer(state, player);
      }
      continue;
    }

    movePlayer(player, dtMs);
    player.fireCooldownMs -= dtMs;
    if (player.fireCooldownMs <= 0) {
      firePlayer(state, player);
      player.fireCooldownMs = FIRE_INTERVAL_MS;
    }
  }

  while (state.timeMs >= state.nextEnemyAt) {
    spawnEnemy(state);
    state.nextEnemyAt += spawnIntervalForWave(state.wave);
  }

  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += (bullet.vx * dtMs) / 1000;
    bullet.y += (bullet.vy * dtMs) / 1000;
    return (
      bullet.y > -20 &&
      bullet.x > -20 &&
      bullet.x < WORLD_WIDTH + 20
    );
  });

  state.enemies = state.enemies.filter((enemy) => {
    enemy.y += (enemy.vy * dtMs) / 1000;
    return enemy.y < WORLD_HEIGHT + 40;
  });

  for (let bulletIndex = state.bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
    const bullet = state.bullets[bulletIndex];
    let hit = false;

    for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
      const enemy = state.enemies[enemyIndex];
      if (
        distanceSq(bullet.x, bullet.y, enemy.x, enemy.y) <=
        (BULLET_RADIUS + ENEMY_RADIUS) ** 2
      ) {
        state.bullets.splice(bulletIndex, 1);
        enemy.hp -= 1;
        state.events.push({ type: 'enemy-hit', x: enemy.x, y: enemy.y });

        if (enemy.hp <= 0) {
          state.enemies.splice(enemyIndex, 1);
          state.score += ENEMY_SCORE;
          state.events.push({
            type: 'enemy-killed',
            x: enemy.x,
            y: enemy.y,
          });
        }

        hit = true;
        break;
      }
    }

    if (hit) {
      continue;
    }
  }

  for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
    const enemy = state.enemies[enemyIndex];

    for (const player of Object.values(state.players)) {
      if (!player.alive || state.timeMs < player.invincibleUntil) {
        continue;
      }

      if (
        distanceSq(enemy.x, enemy.y, player.x, player.y) <=
        (ENEMY_RADIUS + PLAYER_HITBOX_RADIUS) ** 2
      ) {
        state.enemies.splice(enemyIndex, 1);
        killPlayer(state, player);
        break;
      }
    }
  }
}
