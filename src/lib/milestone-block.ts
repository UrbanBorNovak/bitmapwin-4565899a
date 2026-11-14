/** Bitcoin Milestone matcher: maps a real-world moment to the block mined at or just before it. */
export const GENESIS_UNIX = 1231006505; // block 0 timestamp, 2009-01-03 18:15:05 UTC

export type MilestonePreset = { label: string; height: number };
export const MILESTONE_PRESETS: MilestonePreset[] = [
  { label: "Genesis block", height: 0 },
  { label: "Pizza Day purchase", height: 57043 },
  { label: "1st halving", height: 210000 },
  { label: "2nd halving", height: 420000 },
  { label: "3rd halving", height: 630000 },
  { label: "4th halving", height: 840000 },
];

/** Parse a datetime-local value ("YYYY-MM-DDTHH:mm") as UTC or browser-local time. Returns unix seconds or null. */
export function momentToUnix(value: string, utc: boolean): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map((x) => Number(x ?? 0)) as [number, number, number, number, number];
  const ms = utc
    ? Date.UTC(+y, +mo - 1, +d, +h, +mi)
    : new Date(+y, +mo - 1, +d, +h, +mi).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export type MomentCheck = "pre-genesis" | "future" | "ok";
export function checkMoment(unix: number, nowUnix: number): MomentCheck {
  if (unix < GENESIS_UNIX) return "pre-genesis";
  if (unix > nowUnix) return "future";
  return "ok";
}

/** Human gap between the moment and the block, e.g. "3 min after". Block timestamps are miner-set (±2h tolerance). */
export function gapLabel(momentUnix: number, blockUnix: number): string {
  const diff = blockUnix - momentUnix;
  const abs = Math.abs(diff);
  const word = diff >= 0 ? "after" : "before";
  if (abs < 60) return `${abs} s ${word}`;
  if (abs < 3600) return `${Math.round(abs / 60)} min ${word}`;
  return `${(abs / 3600).toFixed(1)} h ${word}`;
}
