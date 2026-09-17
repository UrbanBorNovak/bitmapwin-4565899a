/**
 * GUNNER BRAIN — the combat intelligence that rides in every armed vehicle.
 *
 * This is the same philosophy as the fly brain: it thinks entirely in
 * arithmetic, in the browser, on the frame. No model call, no server tick, no
 * tokens — a tank crossing a crowded Oasis costs nothing to run.
 *
 * How it thinks, once per frame:
 *   1. TRACK   — remember every contact it has seen and differentiate its
 *                position into a velocity estimate.
 *   2. SCORE   — rank contacts by a utility of range, closing speed, how
 *                hostile they are, how nearly wounded they are, and how far the
 *                turret must swing to reach them.
 *   3. COMMIT  — keep the current target until a rival clearly outscores it
 *                (hysteresis), so the turret never twitches between two mobs.
 *   4. LEAD    — solve a two-pass intercept so the shell is aimed where the
 *                target will be, not where it is.
 *   5. ACT     — plain thresholds decide the state and pull the trigger:
 *                scan, track, lock, fire, evade or cool.
 *
 * Step 5 is ordinary code on purpose. Everything the crew "decides" is a
 * threshold you can read and tune here.
 */

import { createDuelBook, predictPath, type DuelBook } from "./duel-model";
import { readPolicy } from "./gunner-policy";

export type GunnerTargetKind = "beast" | "peer";


export type GunnerTarget = {
  id: string;
  kind: GunnerTargetKind;
  label: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  hostile: boolean;
  /** hit sphere around the body, world units */
  radius: number;
};

export type GunnerSense = {
  /** milliseconds, monotonic */
  now: number;
  /** muzzle position of the vehicle */
  x: number;
  y: number;
  z: number;
  /** where the hull points, radians */
  yaw: number;
  /** hull speed, world units per second */
  speed: number;
  hp: number;
  maxHp: number;
  /** how far this gun reaches, world units */
  range: number;
  /** how fast the shell travels, world units per second */
  shellSpeed: number;
  /** milliseconds left before the gun can fire again */
  cooldownRemaining: number;
  /** true while the crew is cleared to pull the trigger itself */
  autoFire: boolean;
  contacts: GunnerTarget[];
};

export type GunnerState = "scan" | "track" | "aim" | "lock" | "fire" | "evade" | "cool";

export type GunnerAct = {
  state: GunnerState;
  target: GunnerTarget | null;
  /** intercept point the turret is pointed at */
  aimX: number;
  aimY: number;
  aimZ: number;
  aimYaw: number;
  aimPitch: number;
  /** 0..1 how squarely the hull already faces the intercept point */
  align: number;
  /** how far the intercept point is, world units */
  distance: number;
  /** true on the frame the crew pulls the trigger */
  fire: boolean;
  /** 0..1 pressure the crew feels right now */
  threat: number;
  /** direction the crew wants to break towards while under pressure, radians */
  evadeYaw: number;
  /** short crew callout for the HUD */
  /** 0..1 how much the crew trusts its read of the target's path */
  confidence: number;
  /** 0..1 how far through the settle window the sights are */
  settled: number;
  /** which doctrine row the crew is following */
  doctrine: string;
  /** how fast the turret may swing under this doctrine, rad/s */
  swingRate: number;
  callout: string;

};

type Contact = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  seenAt: number;
};

/** how much better a rival must score before the crew swings the turret */
const SWITCH_MARGIN = 1.25;
/** contacts older than this are forgotten */
const MEMORY_MS = 4_000;
/** the hull must face the intercept this squarely before the crew fires */
const FIRE_ALIGN = 0.985;
/** hostiles this close feel like an emergency */
const PANIC_RANGE = 6;

const wrap = (angle: number) => ((angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

export type GunnerBrain = {
  /** the contact book, one entry per body the crew has seen */
  contacts: Map<string, Contact>;
  /** per-body movement reads: speed, curve, dodge rhythm, trust */
  duel: DuelBook;
  /** id of the body the turret is committed to */
  committed: string | null;
  /** id the sights have been resting on */
  aimingAt: string | null;
  /** when the sights settled on it, ms */
  aimingSince: number;
  state: GunnerState;
  think: (sense: GunnerSense) => GunnerAct;
};

export function createGunnerBrain(): GunnerBrain {
  const contacts = new Map<string, Contact>();
  const brain: GunnerBrain = {
    contacts,
    duel: createDuelBook(),
    committed: null,
    aimingAt: null,
    aimingSince: 0,
    state: "scan",
    think: (sense) => think(brain, sense),
  };
  return brain;
}


function think(brain: GunnerBrain, sense: GunnerSense): GunnerAct {
  const { contacts } = brain;
  const forwardX = Math.sin(sense.yaw);
  const forwardZ = Math.cos(sense.yaw);

  // 1. TRACK — differentiate each contact into a velocity estimate and let the
  // duel model read its path: curve, dodge rhythm and how trustworthy it is.
  brain.duel.forget(sense.now);
  for (const contact of sense.contacts) {
    brain.duel.observe(contact.id, sense.now, contact.x, contact.y, contact.z);
    const seen = contacts.get(contact.id);

    if (seen) {
      const dt = Math.max(16, sense.now - seen.seenAt) / 1000;
      const smooth = dt > 0.6 ? 1 : 0.35;
      seen.vx += ((contact.x - seen.x) / dt - seen.vx) * smooth;
      seen.vy += ((contact.y - seen.y) / dt - seen.vy) * smooth;
      seen.vz += ((contact.z - seen.z) / dt - seen.vz) * smooth;
      seen.x = contact.x;
      seen.y = contact.y;
      seen.z = contact.z;
      seen.seenAt = sense.now;
    } else {
      contacts.set(contact.id, {
        x: contact.x,
        y: contact.y,
        z: contact.z,
        vx: 0,
        vy: 0,
        vz: 0,
        seenAt: sense.now,
      });
    }
  }
  for (const [id, seen] of contacts) {
    if (sense.now - seen.seenAt > MEMORY_MS) contacts.delete(id);
  }

  // 2. SCORE — rank what is worth a shell.
  let best: GunnerTarget | null = null;
  let bestScore = 0;
  let committedScore = 0;
  let committed: GunnerTarget | null = null;
  let threat = 0;
  let threatX = 0;
  let threatZ = 0;

  for (const contact of sense.contacts) {
    if (contact.hp <= 0) continue;
    const dx = contact.x - sense.x;
    const dz = contact.z - sense.z;
    const distance = Math.hypot(dx, dz);
    if (distance > sense.range) continue;
    const seen = contacts.get(contact.id);
    const closing = seen ? -((seen.vx * dx + seen.vz * dz) / Math.max(0.001, distance)) : 0;
    const bearing = Math.atan2(dx, dz);
    const swing = Math.abs(wrap(bearing - sense.yaw));
    const nearness = 1 - clamp01(distance / sense.range);
    const wounded = 1 - clamp01(contact.hp / Math.max(1, contact.maxHp));
    const facing = 1 - clamp01(swing / Math.PI);

    const score =
      nearness * 2.4 +
      facing * 1.9 +
      (contact.hostile ? 1.6 : 0) +
      (contact.kind === "peer" ? 0.5 : 0) +
      wounded * 1.1 +
      clamp01(closing / 8) * 1.2 +
      clamp01(contact.radius / 3) * 0.4;

    if (contact.hostile) {
      const pressure = clamp01(PANIC_RANGE / Math.max(0.5, distance));
      threat = Math.max(threat, pressure);
      threatX += dx / Math.max(0.001, distance) * pressure;
      threatZ += dz / Math.max(0.001, distance) * pressure;
    }

    if (score > bestScore) {
      bestScore = score;
      best = contact;
    }
    if (contact.id === brain.committed) {
      committed = contact;
      committedScore = score;
    }
  }

  // 3. COMMIT — hysteresis keeps the turret steady.
  let target = committed;
  if (!target || bestScore > committedScore * SWITCH_MARGIN) target = best;
  brain.committed = target?.id ?? null;

  // 4. LEAD — read the target's arc, then solve the intercept under doctrine.
  let aimX = sense.x + forwardX * sense.range * 0.5;
  let aimY = sense.y;
  let aimZ = sense.z + forwardZ * sense.range * 0.5;
  let distance = sense.range * 0.5;
  let confidence = 0;
  let doctrine = "NO DOCTRINE";
  let fireAlign = FIRE_ALIGN;
  let settleNeed = 0;
  let needConfidence = 0;
  let swingRate = 2;

  const hurt = 1 - clamp01(sense.hp / Math.max(1, sense.maxHp));

  if (target) {
    const read = brain.duel.get(target.id);
    const raw = Math.hypot(target.x - sense.x, target.z - sense.z);
    const policy = readPolicy(raw, sense.range, read.speed, read.jitter, threat, hurt);
    doctrine = `${policy.band} · ${policy.note}`;
    confidence = read.confidence;
    fireAlign = policy.align;
    settleNeed = policy.settleMs;
    needConfidence = policy.confidence;
    swingRate = policy.swingRate;

    // two-pass intercept, but each pass predicts along the curved path
    let flight = raw / Math.max(1, sense.shellSpeed);
    let point = { x: target.x, y: target.y, z: target.z };
    for (let pass = 0; pass < 3; pass += 1) {
      point = predictPath(target.x, target.y, target.z, read, flight * policy.leadTrust);
      flight = Math.hypot(point.x - sense.x, point.z - sense.z) / Math.max(1, sense.shellSpeed);
    }
    aimX = point.x;
    aimY = point.y;
    aimZ = point.z;
    distance = Math.hypot(aimX - sense.x, aimZ - sense.z);
  }

  const aimYaw = Math.atan2(aimX - sense.x, aimZ - sense.z);
  const aimPitch = Math.atan2(aimY - sense.y, Math.max(0.001, distance));
  const align = target ? clamp01(Math.cos(wrap(aimYaw - sense.yaw))) : 0;

  // 5. ACT — aim first, then fire. The sights must sit on the intercept for the
  // settle window the doctrine asks for, and the read must be trustworthy.
  const onTarget = Boolean(target) && align >= fireAlign && distance <= sense.range;
  if (!onTarget || brain.aimingAt !== brain.committed) {
    brain.aimingAt = onTarget ? brain.committed : null;
    brain.aimingSince = onTarget ? sense.now : 0;
  }
  const held = brain.aimingSince > 0 ? sense.now - brain.aimingSince : 0;
  const settled = settleNeed > 0 ? clamp01(held / settleNeed) : onTarget ? 1 : 0;
  const trusted = confidence >= needConfidence;
  const pressed = threat > 0.75 && hurt > 0.55;
  const ready = sense.cooldownRemaining <= 0;
  const locked = onTarget;
  const fire = Boolean(sense.autoFire && locked && ready && !pressed && settled >= 1 && trusted);

  let state: GunnerState = "scan";
  if (pressed) state = "evade";
  else if (fire) state = "fire";
  else if (locked && !ready) state = "cool";
  else if (locked && (settled < 1 || !trusted)) state = "aim";
  else if (locked) state = "lock";
  else if (target) state = "track";
  brain.state = state;


  const evadeYaw =
    threat > 0 ? Math.atan2(-threatX, -threatZ) : sense.yaw + (sense.speed > 0.2 ? 0 : Math.PI);

  return {
    state,
    target,
    aimX,
    aimY,
    aimZ,
    aimYaw,
    aimPitch,
    align,
    distance,
    fire,
    threat,
    evadeYaw,
    confidence,
    settled,
    doctrine,
    swingRate,
    callout: callout(state, target, distance, sense, settled, confidence),
  };
}

function callout(
  state: GunnerState,
  target: GunnerTarget | null,
  distance: number,
  sense: GunnerSense,
  settled: number,
  confidence: number,
) {
  const label = target?.label ?? "NO CONTACT";
  switch (state) {
    case "fire":
      return `FIRING · ${label}`;
    case "aim":
      return `AIMING · ${label} · ${(settled * 100).toFixed(0)}% · READ ${(confidence * 100).toFixed(0)}%`;
    case "lock":
      return `LOCKED · ${label} · ${distance.toFixed(0)}M`;
    case "cool":
      return `RELOADING · ${(sense.cooldownRemaining / 1000).toFixed(1)}S`;
    case "track":
      return `TRACKING · ${label} · ${distance.toFixed(0)}M`;
    case "evade":
      return "BREAK OFF · TAKING FIRE";
    default:
      return "SCANNING";
  }
}

