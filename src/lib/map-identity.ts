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
const AVATAR_SKIN_KEY = "bitmap-map-avatar-skin";

/** The rigged on-chain GLB every visitor wears unless they equip their own. */
export const DEFAULT_AVATAR_MODEL =
  "5e2d04efb32bc584af0f86ca9d0744186c680ced298a33235dc913a5f13e2f34i0";
/** The on-chain PNG skin painted on the default figure. */
export const DEFAULT_AVATAR_TEXTURE =
  "02a42a16913bfcdb1d48323850c1a2fab1633e4c1e151bc64c2bd8a5a5cdfacfi0";

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

/**
 * The pixel skin painted on the default figure. Any of the on-chain BITMAP pixel
 * skins can be worn; empty means the stock skin.
 */
export function avatarSkinInscription(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(AVATAR_SKIN_KEY);
  return stored && stored.trim() ? stored.trim() : null;
}

export function setAvatarSkinInscription(inscriptionId: string | null) {
  if (typeof window === "undefined") return;
  const clean = (inscriptionId ?? "").trim();
  if (clean) window.localStorage.setItem(AVATAR_SKIN_KEY, clean);
  else window.localStorage.removeItem(AVATAR_SKIN_KEY);
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

/**
 * Wardrobe: extra on-chain GLB inscription ids this browser keeps around so they
 * can be equipped, unequipped and swapped from the in-world inventory panel.
 */
const WARDROBE_KEY = "bitmap-map-wardrobe";

export function avatarWardrobe(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WARDROBE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
  } catch {
    return [];
  }
}

function writeWardrobe(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WARDROBE_KEY, JSON.stringify(ids.slice(0, 40)));
}

export function addToWardrobe(inscriptionId: string): string[] {
  const clean = inscriptionId.trim();
  if (!clean) return avatarWardrobe();
  const next = [...new Set([clean, ...avatarWardrobe()])];
  writeWardrobe(next);
  return next;
}

export function removeFromWardrobe(inscriptionId: string): string[] {
  const next = avatarWardrobe().filter((id) => id !== inscriptionId);
  writeWardrobe(next);
  return next;
}

/**
 * Last standing spot in the world, so closing the tab and coming back drops you
 * where you left off instead of at the chain tip.
 */
const POSE_KEY = "bitmap-map-last-pose";

export type SavedPose = { x: number; z: number; yaw: number };

export function readLastPose(): SavedPose | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POSE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedPose>;
    const { x, z, yaw } = parsed ?? {};
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(yaw)) return null;
    return { x: x as number, z: z as number, yaw: yaw as number };
  } catch {
    return null;
  }
}

export function saveLastPose(pose: SavedPose) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !Number.isFinite(pose.yaw)) return;
  try {
    window.localStorage.setItem(POSE_KEY, JSON.stringify(pose));
  } catch {
    /* storage full or blocked — position simply is not remembered */
  }
}
