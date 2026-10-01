/**
 * SPACE + TIME — shared clock for the Oasis time-lapse view.
 *
 * The playhead lives outside React so the 3D scene can read and advance it
 * every frame without re-rendering the interface sixty times a second. The
 * scrubber writes to it; a low-frequency ticker reads it for the labels.
 */

export type SpaceTimeClock = {
  /** 0 = start of the recorded window, 1 = now. */
  playhead: number;
  playing: boolean;
  /** Playhead units per second. */
  speed: number;
};

export const spaceTimeClock: SpaceTimeClock = {
  playhead: 0,
  playing: true,
  speed: 0.07,
};

export function resetSpaceTimeClock() {
  spaceTimeClock.playhead = 0;
  spaceTimeClock.playing = true;
}

const GRID = 1_000;
const WORLD_SIZE = 850;
export const SPACE_TIME_CELL = WORLD_SIZE / GRID;

/** Same placement the walkable world uses, so a mark lands on its own BITMAP. */
export function spaceTimePosition(height: number): [number, number] {
  const col = height % GRID;
  const row = Math.floor(height / GRID);
  return [(col + 0.5) * SPACE_TIME_CELL - WORLD_SIZE / 2, (row + 0.5) * SPACE_TIME_CELL];
}

export type SpaceTimeMark = {
  id: string;
  height: number;
  x: number;
  z: number;
  /** 0..1 position of this moment inside the recorded window. */
  t: number;
  at: number;
  title: string;
  kind: string;
};

export type SpaceTimeTrack = {
  marks: SpaceTimeMark[];
  from: number;
  to: number;
};

/** Turns recorded history into a time-ordered track of places on the world floor. */
export function buildSpaceTimeTrack(
  events: { id: string; bitmapHeight: number | null; occurredAt: string; title: string; eventType: string }[],
): SpaceTimeTrack {
  const placed = events
    .filter((event) => event.bitmapHeight !== null)
    .map((event) => ({ event, at: new Date(event.occurredAt).getTime() }))
    .filter((row) => Number.isFinite(row.at))
    .sort((a, b) => a.at - b.at);

  if (placed.length === 0) return { marks: [], from: 0, to: 0 };
  const from = placed[0]!.at;
  const to = Math.max(placed[placed.length - 1]!.at, from + 1);
  const span = to - from;

  return {
    from,
    to,
    marks: placed.map(({ event, at }) => {
      const [x, z] = spaceTimePosition(event.bitmapHeight as number);
      return {
        id: event.id,
        height: event.bitmapHeight as number,
        x,
        z,
        t: (at - from) / span,
        at,
        title: event.title,
        kind: event.eventType,
      };
    }),
  };
}

export function spaceTimeLabel(track: SpaceTimeTrack, playhead: number): string {
  if (track.marks.length === 0) return "NO HISTORY YET";
  const at = track.from + (track.to - track.from) * Math.min(1, Math.max(0, playhead));
  return new Date(at)
    .toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .toUpperCase();
}
