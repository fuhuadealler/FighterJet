import {
  COLORS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Snapshot,
} from '@fighterjet/shared';

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
}

const STARS: Star[] = Array.from({ length: 58 }, (_, index) => ({
  x: (index * 97 + 17) % WORLD_WIDTH,
  y: (index * 53 + 31) % WORLD_HEIGHT,
  speed: 8 + (index % 7) * 5,
  size: index % 11 === 0 ? 2 : 1,
}));

function drawStars(
  context: CanvasRenderingContext2D,
  timeMs: number,
): void {
  context.fillStyle = 'rgba(242, 242, 242, 0.28)';

  for (const star of STARS) {
    const y = (star.y + timeMs * 0.001 * star.speed) % WORLD_HEIGHT;
    context.fillRect(Math.round(star.x), Math.round(y), star.size, star.size);
  }
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.fillStyle = color;
  context.fillRect(-2, -12, 4, 24);
  context.fillRect(-10, 4, 20, 4);
  context.fillRect(-6, 12, 12, 3);
  context.fillRect(-2, -15, 4, 4);
  context.fillStyle = COLORS.background;
  context.fillRect(-1, -3, 2, 9);
  context.restore();
}

function drawEnemy(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.fillStyle = COLORS.enemy;
  context.fillRect(-8, -8, 16, 16);
  context.fillRect(-12, -2, 24, 4);
  context.fillStyle = COLORS.background;
  context.fillRect(-4, -4, 8, 8);
  context.restore();
}

export function renderFrame(
  context: CanvasRenderingContext2D,
  snapshot: Snapshot,
  timeMs: number,
): void {
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawStars(context, timeMs);

  for (const player of snapshot.players) {
    if (!player.alive) {
      continue;
    }
    if (player.invincible && Math.floor(timeMs / 100) % 2 === 0) {
      continue;
    }
    drawPlayer(
      context,
      player.x,
      player.y,
      player.slot === 1 ? COLORS.p1 : COLORS.p2,
    );
  }

  for (const enemy of snapshot.enemies) {
    drawEnemy(context, enemy.x, enemy.y);
  }

  context.fillStyle = COLORS.playerBullet;
  for (const bullet of snapshot.bullets) {
    context.fillRect(Math.round(bullet.x) - 1, Math.round(bullet.y) - 4, 2, 8);
  }
}
