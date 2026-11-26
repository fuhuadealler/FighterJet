import type {
  BulletSnapshot,
  EnemySnapshot,
  PlayerSnapshot,
  Snapshot,
} from '@fighterjet/shared';

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function clampAlpha(alpha: number): number {
  return Math.min(1, Math.max(0, alpha));
}

function interpolatePlayers(
  older: PlayerSnapshot[],
  newer: PlayerSnapshot[],
  alpha: number,
): PlayerSnapshot[] {
  const previous = new Map(older.map((player) => [player.id, player]));
  return newer.map((player) => {
    const before = previous.get(player.id);
    if (!before) {
      return player;
    }
    return {
      ...player,
      x: lerp(before.x, player.x, alpha),
      y: lerp(before.y, player.y, alpha),
    };
  });
}

function interpolateEnemies(
  older: EnemySnapshot[],
  newer: EnemySnapshot[],
  alpha: number,
): EnemySnapshot[] {
  const previous = new Map(older.map((enemy) => [enemy.id, enemy]));
  return newer.map((enemy) => {
    const before = previous.get(enemy.id);
    if (!before) {
      return enemy;
    }
    return {
      ...enemy,
      x: lerp(before.x, enemy.x, alpha),
      y: lerp(before.y, enemy.y, alpha),
    };
  });
}

function interpolateBullets(
  older: BulletSnapshot[],
  newer: BulletSnapshot[],
  alpha: number,
): BulletSnapshot[] {
  const previous = new Map(older.map((bullet) => [bullet.id, bullet]));
  return newer.map((bullet) => {
    const before = previous.get(bullet.id);
    if (!before) {
      return bullet;
    }
    return {
      ...bullet,
      x: lerp(before.x, bullet.x, alpha),
      y: lerp(before.y, bullet.y, alpha),
    };
  });
}

export function interpolateSnapshot(
  older: Snapshot,
  newer: Snapshot,
  alpha: number,
): Snapshot {
  const safeAlpha = clampAlpha(alpha);
  return {
    ...newer,
    serverTimeMs: lerp(older.serverTimeMs, newer.serverTimeMs, safeAlpha),
    players: interpolatePlayers(older.players, newer.players, safeAlpha),
    enemies: interpolateEnemies(older.enemies, newer.enemies, safeAlpha),
    bullets: interpolateBullets(older.bullets, newer.bullets, safeAlpha),
    events: [],
  };
}
