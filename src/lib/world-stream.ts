export type WorldStreamState = {
  chunk: string;
  loaded: number;
  queued: number;
  syncing: boolean;
  fast: boolean;
};

const EMPTY_STREAM: WorldStreamState = {
  chunk: "0:0",
  loaded: 0,
  queued: 0,
  syncing: false,
  fast: false,
};

let state = EMPTY_STREAM;
const listeners = new Set<() => void>();

export function updateWorldStream(next: WorldStreamState) {
  if (
    state.chunk === next.chunk &&
    state.loaded === next.loaded &&
    state.queued === next.queued &&
    state.syncing === next.syncing &&
    state.fast === next.fast
  ) return;
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeWorldStream(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function worldStreamSnapshot() {
  return state;
}

export function worldStreamServerSnapshot() {
  return EMPTY_STREAM;
}