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
  active: false,
};

/** A jump press is consumed once, like a key press rather than a held key. */
export function consumeTouchJump(): boolean {
  const jump = touchPad.jump;
  touchPad.jump = false;
  return jump;
}

/** Drain the pending look swipe; returns pixels moved since the last frame. */
export function takeTouchLook(): { x: number; y: number } {
  const x = touchPad.lookX;
  const y = touchPad.lookY;
  touchPad.lookX = 0;
  touchPad.lookY = 0;
  return { x, y };
}

export function resetTouchPad() {
  touchPad.forward = 0;
  touchPad.turn = 0;
  touchPad.sprint = false;
  touchPad.lookX = 0;
  touchPad.lookY = 0;
  touchPad.jump = false;
  touchPad.fly = 0;
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
