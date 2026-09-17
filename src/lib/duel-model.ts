/**
 * DUEL MODEL — the crew's read on a single body it is fighting.
 *
 * One model per contact. It keeps a short ring of sightings and turns them into
 * the things a real gunner notices: how fast the target is going, whether it is
 * curving, whether it dodges on a rhythm, and how trustworthy its next second
 * of movement looks.
 *
 * Prediction is a constant-turn-rate arc, not a straight line — players circle
 * and strafe, so a straight extrapolation always misses behind them. Everything
 * is arithmetic on numbers already in memory: no model call, no tokens.
 */

const SAMPLES = 12;
const STALE_MS = 5_000;

type Sample = { t: number; x: number; z: number; y: number };

export type DuelRead = {
  /** planar speed, world units per second */
  speed: number;
  /** heading of travel, radians */
  heading: number;
  /** how hard the path is curving, radians per second (signed) */
  turnRate: number;
  /** vertical speed, world units per second */
  climb: number;
  /** 0..1 how jagged the recent path is — high means dodging */
  jitter: number;
  /** 0..1 how much the crew trusts its own prediction */
  confidence: number;
  /** seconds of the dodge rhythm, 0 when there is none */
  dodgePeriod: number;
};

export type DuelModel = {
  id: string;
  samples: Sample[];
  read: DuelRead;
  lastSeen: number;
};

const EMPTY: DuelRead = {
  speed: 0,
  heading: 0,
  turnRate: 0,
  climb: 0,
  jitter: 0,
  confidence: 0,
  dodgePeriod: 0,
};

const wrap = (a: number) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createDuelBook() {
  const book = new Map<string, DuelModel>();

  const observe = (id: string, now: number, x: number, y: number, z: number): DuelRead => {
    let model = book.get(id);
    if (!model) {
      model = { id, samples: [], read: { ...EMPTY }, lastSeen: now };
      book.set(id, model);
    }
    const last = model.samples[model.samples.length - 1];
    if (!last || now - last.t >= 45) {
      model.samples.push({ t: now, x, y, z });
      if (model.samples.length > SAMPLES) model.samples.shift();
    } else {
      last.x = x;
      last.y = y;
      last.z = z;
    }
    model.lastSeen = now;
    model.read = analyse(model.samples);
    return model.read;
  };

  const forget = (now: number) => {
    for (const [id, model] of book) {
      if (now - model.lastSeen > STALE_MS) book.delete(id);
    }
  };

  return { book, observe, forget, get: (id: string) => book.get(id)?.read ?? EMPTY };
}

export type DuelBook = ReturnType<typeof createDuelBook>;

function analyse(samples: Sample[]): DuelRead {
  if (samples.length < 3) return { ...EMPTY };

  const legs: { dt: number; dist: number; heading: number; climb: number }[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const dt = Math.max(0.016, (b.t - a.t) / 1000);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    legs.push({
      dt,
      dist,
      heading: dist > 0.001 ? Math.atan2(dx, dz) : legs[legs.length - 1]?.heading ?? 0,
      climb: (b.y - a.y) / dt,
    });
  }

  // recent legs count more than old ones
  let wSum = 0;
  let speed = 0;
  let climb = 0;
  legs.forEach((leg, i) => {
    const w = i + 1;
    wSum += w;
    speed += (leg.dist / leg.dt) * w;
    climb += leg.climb * w;
  });
  speed /= wSum;
  climb /= wSum;

  const heading = legs[legs.length - 1].heading;

  // signed turn rate, averaged over the last few legs
  let turnRate = 0;
  let turnWeight = 0;
  let flips = 0;
  let previousTurn = 0;
  for (let i = 1; i < legs.length; i += 1) {
    const delta = wrap(legs[i].heading - legs[i - 1].heading);
    const rate = delta / legs[i].dt;
    const w = i;
    turnRate += rate * w;
    turnWeight += w;
    if (i > 1 && Math.sign(delta) !== 0 && Math.sign(delta) !== Math.sign(previousTurn)) flips += 1;
    previousTurn = delta || previousTurn;
  }
  turnRate = turnWeight > 0 ? turnRate / turnWeight : 0;

  // jitter — direction reversals plus speed variance
  const speeds = legs.map((leg) => leg.dist / leg.dt);
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length;
  const spread = mean > 0.2 ? clamp01(Math.sqrt(variance) / mean) : 0;
  const jitter = clamp01(flips / Math.max(1, legs.length - 2) * 0.8 + spread * 0.5);

  // dodge rhythm — average time between direction reversals
  const dodgePeriod =
    flips > 1
      ? legs.reduce((a, leg) => a + leg.dt, 0) / flips
      : 0;

  const span = (samples[samples.length - 1].t - samples[0].t) / 1000;
  const sampleTrust = clamp01(samples.length / SAMPLES) * clamp01(span / 0.8);
  const confidence = clamp01(sampleTrust * (1 - jitter * 0.8));

  return { speed, heading, turnRate, climb, jitter, confidence, dodgePeriod };
}

/**
 * Where the body will be after `flight` seconds, following the arc it is
 * currently on rather than a straight line.
 */
export function predictPath(
  x: number,
  y: number,
  z: number,
  read: DuelRead,
  flight: number,
): { x: number; y: number; z: number } {
  const t = Math.max(0, Math.min(flight, 4));
  const turn = Math.max(-2.5, Math.min(2.5, read.turnRate));
  const speed = read.speed;

  if (Math.abs(turn) < 0.05) {
    return {
      x: x + Math.sin(read.heading) * speed * t,
      y: y + read.climb * t,
      z: z + Math.cos(read.heading) * speed * t,
    };
  }

  // constant-speed, constant-turn arc
  const radius = speed / turn;
  const h0 = read.heading;
  const h1 = h0 + turn * t;
  return {
    x: x + radius * (Math.cos(h0) - Math.cos(h1)),
    y: y + read.climb * t,
    z: z + radius * (Math.sin(h1) - Math.sin(h0)),
  };
}
