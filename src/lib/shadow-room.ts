/**
 * SHADOW ROOM BRIDGE — the archway in the open world asks the overlay to open
 * a private chamber. No pass secret ever crosses this bridge, only the public
 * event slug and title; the vault check happens on the device that holds it.
 */
export type ShadowRoomRequest = { slug: string; title: string };

type Listener = (req: ShadowRoomRequest) => void;

const listeners = new Set<Listener>();

export function onShadowRoom(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function enterShadowRoom(req: ShadowRoomRequest) {
  for (const fn of listeners) fn(req);
}
