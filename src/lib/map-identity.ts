import { colorForAddress } from "@/lib/map-owners";

/**
 * A stable-per-browser visitor identity for the land map. It ties a visitor's
 * live cursor dot on the map to the messages they post in the map chat, so the
 * colour you see moving over the land matches the colour next to their name.
 *
 * Nothing here identifies a person — it is a random id kept in localStorage.
 */
const ID_KEY = "bitmap-map-visitor-id";
const HANDLE_KEY = "bitmap-map-handle";
const AVATAR_MODEL_KEY = "bitmap-map-avatar-model";

/** Inscription id of the on-chain GLB this browser wears as its avatar. */
export function avatarModelInscription(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(AVATAR_MODEL_KEY);
  return stored && stored.trim() ? stored.trim() : null;
}

export function setAvatarModelInscription(inscriptionId: string | null) {
  if (typeof window === "undefined") return;
  const clean = (inscriptionId ?? "").trim();
  if (clean) window.localStorage.setItem(AVATAR_MODEL_KEY, clean);
  else window.localStorage.removeItem(AVATAR_MODEL_KEY);
}


function randomId() {
  return crypto.randomUUID();
}

export function mapVisitorId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    window.localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function defaultHandle(id: string): string {
  return `ANON-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export function mapHandle(): string {
  if (typeof window === "undefined") return "ANON";
  const stored = window.localStorage.getItem(HANDLE_KEY);
  return stored && stored.trim() ? stored.trim() : defaultHandle(mapVisitorId());
}

export function setMapHandle(handle: string) {
  if (typeof window === "undefined") return;
  const clean = handle.trim().slice(0, 20);
  if (clean) window.localStorage.setItem(HANDLE_KEY, clean);
  else window.localStorage.removeItem(HANDLE_KEY);
}

export function colorForVisitor(id: string): string {
  return colorForAddress(id);
}
