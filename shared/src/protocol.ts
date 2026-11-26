import type { PlayerId, PlayerInput, Snapshot } from './types';

export type ClientMessage =
  | { type: 'input'; input: PlayerInput }
  | { type: 'ready' };

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: PlayerId;
      token: string;
      slot: 1 | 2;
      color: string;
    }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'full' }
  | { type: 'error'; message: string };

function asBoolean(value: unknown): boolean {
  return value === true;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function sanitizeInput(value: unknown): PlayerInput {
  const record =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return {
    up: asBoolean(record.up),
    down: asBoolean(record.down),
    left: asBoolean(record.left),
    right: asBoolean(record.right),
    targetX: finiteNumber(record.targetX),
    targetY: finiteNumber(record.targetY),
  };
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.type === 'input') {
      return { type: 'input', input: sanitizeInput(value.input) };
    }
    if (value.type === 'ready') {
      return { type: 'ready' };
    }
    return null;
  } catch {
    return null;
  }
}
