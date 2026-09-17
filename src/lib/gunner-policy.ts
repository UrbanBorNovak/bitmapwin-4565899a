/**
 * GUNNER POLICY — the distilled combat doctrine.
 *
 * The reasoning here was authored once, offline, and *baked into constants*.
 * Nothing in this file calls a model, a server or a network at runtime, so the
 * smartest crew in the Oasis still costs zero credits and zero tokens.
 *
 * A policy is a small lookup: bucket the situation (range band, target motion,
 * pressure, gun cadence), read the doctrine row, get the numbers the brain
 * should act on — how much lead to trust, how long to settle the sights before
 * firing, how confident it must be, and when to hold fire entirely.
 */

export type RangeBand = "point" | "close" | "mid" | "far";
export type MotionBand = "still" | "walk" | "sprint" | "erratic";
export type PressureBand = "calm" | "harried" | "critical";

export type PolicyRow = {
  /** how much of the predicted intercept to trust, 0..1 */
  leadTrust: number;
  /** how long the sights must sit on the intercept before firing, ms */
  settleMs: number;
  /** minimum prediction confidence required to fire, 0..1 */
  confidence: number;
  /** how squarely the hull must face the intercept, cosine */
  align: number;
  /** how fast the turret is allowed to swing, radians per second */
  swingRate: number;
  /** doctrine note for the HUD */
  note: string;
};

/**
 * Distilled doctrine. Read as: at this range, against this kind of movement,
 * under this much pressure — do this.
 *
 * The shape of the table is the lesson: close targets need almost no lead but
 * a fast turret; far, erratic targets need heavy prediction, a long settle and
 * high confidence, because a wasted shell is a wasted reload.
 */
const DOCTRINE: Record<RangeBand, Record<MotionBand, PolicyRow>> = {
  point: {
    still: { leadTrust: 0.15, settleMs: 60, confidence: 0.2, align: 0.93, swingRate: 3.4, note: "SNAP SHOT" },
    walk: { leadTrust: 0.35, settleMs: 90, confidence: 0.25, align: 0.94, swingRate: 3.4, note: "SNAP SHOT" },
    sprint: { leadTrust: 0.6, settleMs: 120, confidence: 0.3, align: 0.95, swingRate: 3.8, note: "SWING THROUGH" },
    erratic: { leadTrust: 0.5, settleMs: 150, confidence: 0.35, align: 0.95, swingRate: 3.8, note: "SWING THROUGH" },
  },
  close: {
    still: { leadTrust: 0.4, settleMs: 110, confidence: 0.3, align: 0.965, swingRate: 2.6, note: "DIRECT LAY" },
    walk: { leadTrust: 0.8, settleMs: 160, confidence: 0.4, align: 0.97, swingRate: 2.6, note: "LEAD THE WALK" },
    sprint: { leadTrust: 1, settleMs: 200, confidence: 0.5, align: 0.975, swingRate: 3, note: "FULL LEAD" },
    erratic: { leadTrust: 0.75, settleMs: 260, confidence: 0.55, align: 0.975, swingRate: 3, note: "WAIT FOR THE CUT" },
  },
  mid: {
    still: { leadTrust: 0.5, settleMs: 180, confidence: 0.4, align: 0.982, swingRate: 1.9, note: "DELIBERATE" },
    walk: { leadTrust: 1, settleMs: 240, confidence: 0.5, align: 0.985, swingRate: 1.9, note: "LEAD THE WALK" },
    sprint: { leadTrust: 1.05, settleMs: 300, confidence: 0.6, align: 0.988, swingRate: 2.2, note: "FULL LEAD" },
    erratic: { leadTrust: 0.7, settleMs: 380, confidence: 0.7, align: 0.988, swingRate: 2.2, note: "HOLD FOR PATTERN" },
  },
  far: {
    still: { leadTrust: 0.6, settleMs: 260, confidence: 0.5, align: 0.991, swingRate: 1.3, note: "RANGED LAY" },
    walk: { leadTrust: 1.05, settleMs: 340, confidence: 0.62, align: 0.992, swingRate: 1.3, note: "LONG LEAD" },
    sprint: { leadTrust: 1.1, settleMs: 420, confidence: 0.72, align: 0.993, swingRate: 1.5, note: "LONG LEAD" },
    erratic: { leadTrust: 0.6, settleMs: 520, confidence: 0.82, align: 0.993, swingRate: 1.5, note: "HOLD · UNPREDICTABLE" },
  },
};

/** pressure bends the doctrine instead of replacing it */
const PRESSURE: Record<PressureBand, { settle: number; confidence: number; align: number; swing: number }> = {
  calm: { settle: 1, confidence: 1, align: 1, swing: 1 },
  harried: { settle: 0.75, confidence: 0.9, align: 0.998, swing: 1.25 },
  critical: { settle: 0.45, confidence: 0.75, align: 0.994, swing: 1.5 },
};

export function rangeBand(distance: number, range: number): RangeBand {
  const ratio = distance / Math.max(1, range);
  if (ratio < 0.15) return "point";
  if (ratio < 0.4) return "close";
  if (ratio < 0.75) return "mid";
  return "far";
}

export function motionBand(speed: number, jitter: number): MotionBand {
  if (jitter > 0.55) return "erratic";
  if (speed < 0.6) return "still";
  if (speed < 3.2) return "walk";
  return "sprint";
}

export function pressureBand(threat: number, hurt: number): PressureBand {
  if (threat > 0.75 && hurt > 0.5) return "critical";
  if (threat > 0.45 || hurt > 0.3) return "harried";
  return "calm";
}

export function readPolicy(
  distance: number,
  range: number,
  speed: number,
  jitter: number,
  threat: number,
  hurt: number,
): PolicyRow & { band: string } {
  const rb = rangeBand(distance, range);
  const mb = motionBand(speed, jitter);
  const pb = pressureBand(threat, hurt);
  const row = DOCTRINE[rb][mb];
  const bend = PRESSURE[pb];
  return {
    leadTrust: row.leadTrust,
    settleMs: Math.round(row.settleMs * bend.settle),
    confidence: row.confidence * bend.confidence,
    align: Math.min(0.999, row.align * bend.align),
    swingRate: row.swingRate * bend.swing,
    note: row.note,
    band: `${rb.toUpperCase()}/${mb.toUpperCase()}`,
  };
}
