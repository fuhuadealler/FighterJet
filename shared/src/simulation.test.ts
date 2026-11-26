import { describe, expect, it } from 'vitest';
import { PLAYER_BOUNDS, SHARED_LIVES, TICK_MS } from './constants';
import { createRun, stepGame } from './simulation';
import type { GameState } from './types';

function withoutSpawns(state: GameState): GameState {
  state.nextEnemyAt = Number.MAX_SAFE_INTEGER;
  state.players.p1.fireCooldownMs = Number.MAX_SAFE_INTEGER;
  state.players.p2.fireCooldownMs = Number.MAX_SAFE_INTEGER;
  return state;
}

describe('FighterJet simulation', () => {
  it('starts both players with three shared lives', () => {
    const state = createRun();

    expect(Object.keys(state.players)).toEqual(['p1', 'p2']);
    expect(state.lives).toBe(SHARED_LIVES);
    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
  });

  it('auto-fires player bullets', () => {
    const state = withoutSpawns(createRun());
    state.players.p1.fireCooldownMs = 0;
    state.players.p2.fireCooldownMs = 0;

    stepGame(state, TICK_MS);

    expect(state.bullets.some((bullet) => bullet.owner === 'p1')).toBe(true);
    expect(state.bullets.some((bullet) => bullet.owner === 'p2')).toBe(true);
  });

  it('scores when a bullet kills an enemy', () => {
    const state = withoutSpawns(createRun());
    state.bullets.push({
      id: 999,
      owner: 'p1',
      x: 180,
      y: 100,
      vx: 0,
      vy: 0,
    });
    state.enemies.push({ id: 1000, x: 180, y: 100, vy: 0, hp: 1 });

    stepGame(state, TICK_MS);

    expect(state.score).toBe(100);
    expect(state.enemies).toHaveLength(0);
    expect(state.events.some((event) => event.type === 'enemy-killed')).toBe(
      true,
    );
  });

  it('loses a shared life and respawns with invincibility', () => {
    const state = withoutSpawns(createRun());
    state.enemies.push({
      id: 1000,
      x: state.players.p1.x,
      y: state.players.p1.y,
      vy: 0,
      hp: 1,
    });

    stepGame(state, TICK_MS);

    expect(state.lives).toBe(SHARED_LIVES - 1);
    expect(state.players.p1.alive).toBe(false);
    expect(state.players.p1.respawnAt).toBeGreaterThan(0);

    state.timeMs = state.players.p1.respawnAt - 1;
    stepGame(state, TICK_MS);

    expect(state.players.p1.alive).toBe(true);
    expect(state.players.p1.invincibleUntil).toBeGreaterThan(state.timeMs);
  });

  it('charges two lives when both players die in the same tick', () => {
    const state = withoutSpawns(createRun());
    state.enemies.push(
      {
        id: 1000,
        x: state.players.p1.x,
        y: state.players.p1.y,
        vy: 0,
        hp: 1,
      },
      {
        id: 1001,
        x: state.players.p2.x,
        y: state.players.p2.y,
        vy: 0,
        hp: 1,
      },
    );

    stepGame(state, TICK_MS);

    expect(state.lives).toBe(SHARED_LIVES - 2);
    expect(state.players.p1.alive).toBe(false);
    expect(state.players.p2.alive).toBe(false);
  });

  it('ends the run when shared lives reach zero', () => {
    const state = withoutSpawns(createRun());
    state.lives = 1;
    state.enemies.push({
      id: 1000,
      x: state.players.p1.x,
      y: state.players.p1.y,
      vy: 0,
      hp: 1,
    });

    stepGame(state, TICK_MS);

    expect(state.lives).toBe(0);
    expect(state.gameOver).toBe(true);
    expect(state.events.some((event) => event.type === 'game-over')).toBe(
      true,
    );
  });

  it('clamps keyboard movement to the playfield', () => {
    const state = withoutSpawns(createRun());
    state.players.p1.input = {
      up: false,
      down: false,
      left: true,
      right: false,
    };

    for (let index = 0; index < 200; index++) {
      stepGame(state, TICK_MS);
    }

    expect(state.players.p1.x).toBe(PLAYER_BOUNDS.minX);
  });
});
