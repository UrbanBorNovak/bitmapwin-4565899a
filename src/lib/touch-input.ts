/**
 * TOUCH INPUT — one shared pad state for phones and tablets.
 *
 * The world already walks on held keys and a locked mouse. Neither exists on a
 * phone, so the on-screen pads write into this small mutable record and the
 * camera rig reads it beside the keyboard every frame. Look deltas accumulate
 * here and are drained once per frame so a fast swipe is never lost between
 * frames.
 */
export type TouchPad = {
  /** -1 back .. 1 forward, from the left stick */
  forward: number;
  /** -1 right .. 1 left, from the left stick (turns the body) */
  turn: number;
  sprint: boolean;
  /** pending look delta in pixels, drained by takeTouchLook() */
  lookX: number;
  lookY: number;
  jump: boolean;
  /** climb / sink while flying a ride: 1 up, -1 down */
  fly: number;
  /** held pedal aboard a ride: 1 accelerate, -1 reverse, 0 coast */
  throttle: number;
  /** true while a ride's boost pedal is held */
  boost: boolean;
  /** true while any on-screen pad is being held */
  active: boolean;
};

export const touchPad: TouchPad = {
  forward: 0,
  turn: 0,
  sprint: false,
  lookX: 0,
  lookY: 0,
  jump: false,
  fly: 0,
  throttle: 0,
  boost: false,
  active: false,
};

/** A jump press is consumed once, like a key press rather than a held key. */
export function consumeTouchJump(): boolean {
  const jump = touchPad.jump;
  touchPad.jump = false;
  return jump;
}

/** Drain the pending look swipe; returns pixels moved since the last frame. */
export function takeTouchLook(delta = 1): { x: number; y: number } {
  const blend = 1 - Math.exp(-35 * Math.max(0, delta));
  const x = touchPad.lookX * blend;
  const y = touchPad.lookY * blend;
  touchPad.lookX -= x;
  touchPad.lookY -= y;
  return { x, y };
}

const smoothMove = { forward: 0, turn: 0 };

/** A continuous radial deadzone reaches full speed at the stick rim. */
export function stickIntent(x: number, y: number) {
  const length = Math.hypot(x, y);
  if (length <= 0.12) return { forward: 0, turn: 0 };
  const strength = Math.min(1, (length - 0.12) / 0.88);
  return { forward: y === 0 ? 0 : -y / length * strength, turn: x === 0 ? 0 : -x / length * strength };
}

/** Ease held intent, but release immediately: no unwanted coasting. */
export function takeTouchMovement(delta: number) {
  const blend = 1 - Math.exp(-22 * Math.max(0, delta));
  smoothMove.forward = touchPad.forward === 0 ? 0 : smoothMove.forward + (touchPad.forward - smoothMove.forward) * blend;
  smoothMove.turn = touchPad.turn === 0 ? 0 : smoothMove.turn + (touchPad.turn - smoothMove.turn) * blend;
  return smoothMove;
}

export function resetTouchPad() {
  smoothMove.forward = 0;
  smoothMove.turn = 0;
  touchPad.forward = 0;
  touchPad.turn = 0;
  touchPad.sprint = false;
  touchPad.lookX = 0;
  touchPad.lookY = 0;
  touchPad.jump = false;
  touchPad.fly = 0;
  touchPad.throttle = 0;
  touchPad.boost = false;
  touchPad.active = false;
}

/** Coarse pointer with touch points: a phone or tablet, not a trackpad laptop. */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches &&
    (navigator.maxTouchPoints ?? 0) > 0
  );
}
