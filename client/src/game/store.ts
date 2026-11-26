import type { PlayerId, Snapshot } from '@fighterjet/shared';

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'full'
  | 'error'
  | 'closed';

export interface ClientViewState {
  status: ConnectionStatus;
  playerId: PlayerId | null;
  snapshot: Snapshot | null;
  error: string | null;
}

export class ClientStore {
  private state: ClientViewState = {
    status: 'connecting',
    playerId: null,
    snapshot: null,
    error: null,
  };

  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): ClientViewState => this.state;

  set(patch: Partial<ClientViewState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const store = new ClientStore();
