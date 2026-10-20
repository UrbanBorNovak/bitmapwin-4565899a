/**
 * Matrix-style "bullet time" orbit for Oasis: on specific world events the
 * camera sweeps a fast arc around the frozen-looking player, then hands
 * control straight back. Pure maths + a tiny state holder; the camera rig
 * in BitmapWorld3D applies the frame.
 */
export type BulletEvent = "board" | "anomaly" | "sealed" | "hard-landing";

export const BULLET_DURATION = 2.6; // seconds
export const BULLET_COOLDOWN = 25; // seconds between sweeps of any kind

export interface BulletShot {
  event: BulletEvent;
  startedAt: number;
  /** Camera yaw the sweep starts from, so it begins where the view already is. */
  fromYaw: number;
  /** +1 or -1: sweep direction. */
  dir: number;
}

let current: BulletShot | null = null;
let lastAt = -Infinity;

export const bulletTime = {
  active: () => current,
  /** Starts a sweep unless one is running or the cooldown hasn't passed. */
  trigger(event: BulletEvent, now: number, fromYaw: number): boolean {
    if (current || now - lastAt < BULLET_COOLDOWN) return false;
    current = { event, startedAt: now, fromYaw, dir: Math.floor(now * 7) % 2 === 0 ? 1 : -1 };
    lastAt = now;
    return true;
  },
  stop() { current = null; },
  /** Test helper. */
  reset() { current = null; lastAt = -Infinity; },
};

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/**
 * Camera offset relative to the player for time `t` into the sweep.
 * Sweeps 300° (ends roughly back behind the player), dips low mid-arc,
 * with a tight radius and a narrowed FOV for the "frozen moment" look.
 */
export function bulletFrame(shot: BulletShot, t: number, unit: number) {
  const p = Math.max(0, Math.min(1, t / BULLET_DURATION));
  const k = ease(p);
  const yaw = shot.fromYaw + shot.dir * k * (Math.PI * 5) / 3;
  const radius = unit * (14 - Math.sin(p * Math.PI) * 5);
  const height = unit * (9 - Math.sin(p * Math.PI) * 6);
  return {
    offset: { x: -Math.sin(yaw) * radius, y: height, z: -Math.cos(yaw) * radius },
    lookY: unit * 5,
    /** FOV multiplier: narrows during the hold, back to 1 at the end. */
    fovScale: 1 - Math.sin(p * Math.PI) * 0.28,
    /** Small dutch roll in the middle of the arc. */
    roll: Math.sin(p * Math.PI * 2) * 0.08 * shot.dir,
    done: t >= BULLET_DURATION - 1e-6,
  };
}

export function cueToBullet(kind: string): BulletEvent | null {
  return kind === "board" || kind === "anomaly" || kind === "sealed" ? kind : null;
}

/**
 * One frame of the bullet-time camera, kept pure so every trigger, skip and
 * cooldown path is testable without a GPU. Only plays in third person.
 */
export function stepBulletCam(input: {
  pending: BulletEvent | null;
  now: number;
  mode: string;
  blocked: boolean; // landmark flyby or Battle Drop camera
  yaw: number;
  unit: number;
}) {
  if (input.blocked || input.mode !== "third") {
    if (current) bulletTime.stop();
    return null;
  }
  if (input.pending) bulletTime.trigger(input.pending, input.now, input.yaw);
  const shot = bulletTime.active();
  if (!shot) return null;
  const f = bulletFrame(shot, input.now - shot.startedAt, input.unit);
  if (f.done) { bulletTime.stop(); return null; }
  return f;
}
