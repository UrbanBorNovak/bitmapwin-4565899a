import { PIXELS } from "@/lib/bitmap-pixels-catalog";
import type { AvatarModel, PixelSkin, ToonAvatar } from "@/lib/toon-avatars";
import type { LineCam, Shot, Transition } from "@/lib/toon-script";

/** THE UNREASONABLES co-stars, each wearing a real BITMAP Pixel inscription from the gallery. */
export interface CoStar { id: string; name: string; pixel: string; avatar: ToonAvatar; quip: string; cheer: string }
const px = (id: string) => `px:${id}` as PixelSkin;
const C = (id: string, name: string, pixel: string, ins: string, model: AvatarModel, quip: string, cheer: string): CoStar =>
  ({ id, name, pixel, avatar: { model, skin: px(ins) }, quip, cheer });

export const UNREASONABLES_CAST: CoStar[] = [
  C("tornado", "TORNADO H. THOMPSON", "OG Anchorman @BitMap_News #1", "11e0423355a75b615977f7da49f33f140c68c825f94caacb28762cbd7c8cec26i0", "runner", "Live on Bitmap News! The mempool never sleeps.", "Signing off with the height!"),
  C("dev9", "DEV9", "MM-9", "8c8ec66ead67d22adb99eba945cd881a0260fb71f19dc359603bc89e88aa9f50i0", "bruiser", "Twelve CRTs down in the bedrock, and none of them miss a sat.", "Marauder log updated."),
  C("wierdamoto", "WIERDAMOTO", "V for Vendetta", "5573a6d6207bbe066b36007589e919238d449250ec45a787acbe578d106492e3i0", "vendetta", "Two signatures or none. Self-custody survives every ledger.", "Remember the Night of Two Signatures!"),
  C("bop", "BOP", "DG - 9 #1", "5385de6521ff1de51f1a805938ddeeab2beb22fe434bd5d24155e9529f6bdb86i0", "bot", "If it isn't boptimized, it isn't finished.", "Zero warnings."),
  C("dabber", "ELEVATED DABBER", "Ninja Dabber", "33c832f26dc031e164e74dd0bb39f288088f5b6fd95d224a1f32f2eb42aba0fbi0", "runner", "From the summit the FUD blows away like smoke.", "Elevated above the noise!"),
  C("mr-shiddy", "MR SHIDDY", "MrShiddy3D #1", "4e2c924bebd6e8f8f1d0bd0ff30fce0e761037bff193ba1e20e70dc533666bc1i0", "bruiser", "Everything here is load-bearing. Check the foundations.", "Built like bedrock!"),
  C("jahbooble", "JAHBOOBLE", "Goose Avatar #1", "72b110c1db9489fc1c5e7c671708e834091a0efc5f1a58c909e771fb1fa4c61di0", "runner", "Bless up, newcomer. Hold your keys.", "Blessings upon the block!"),
  C("mononaut", "MONONAUT", "patoshiastronaut", "ece282273b409521e3e05f901ee121e7edb3fdba69023bc889375d5c3a552e65i0", "runner", "I can tell a sweep from a sale from orbit.", "Orbit achieved!"),
  C("sunset", "BITMAP SUNSET", "Green Eyed King", "e181e7a6c584c73dc904be271fbb6f5a7def40dc8c0f5dff0eb562ba21a22d01i0", "wizard", "Orange and cyan tonight. The frequency is calm.", "The sunset never ends!"),
  C("bitoshi", "BITOSHI", "ThanosGob", "9ae8abc069e5291bd6597cba14ae7823139b1d617c4e36753b719122c6e5f215i0", "bruiser", "Pure block matter. Don't touch the recipe.", "Cooked to purity!"),
  C("mr-gold", "MR. GOLD", "Mr. gold 1/1 by Urbannoki #1", "5b657093533d3f29b616fa340d4a5e83a1ae3eff0471b5520799454db2b6eb1di0", "wizard", "I keep the receipts nobody else wanted.", "Added to the archive."),
  C("john-wick", "JOHN WICK", "Jhon Wick #1", "37a31f88699319d3e3fc588f30525326b7458fc873c473003d52e3a8fa0cce69i0", "runner", "Yeah. I'm thinking I'm holding.", "Sovereign custody."),
  C("curator", "ASTRAL", "Astral Arkitekt", "e4fccb50bd55467892db82a113b42a4f8e36bc87caf64cf31da32d04c32cf68bi0", "wizard", "Only chain-proven history hangs in my museum.", "Preserved forever."),
];

const mix = (a: number, b: number) => { let x = (a * 2654435761 + b * 40503 + 0x9e3779b9) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; return x >>> 0; };

/** Two distinct co-stars for (height, seed). */
export function pickCoStars(height: number, seed: number): [CoStar, CoStar] {
  const n = UNREASONABLES_CAST.length, a = mix(height, seed) % n;
  const b = (a + 1 + (mix(seed, height) % (n - 1))) % n;
  return [UNREASONABLES_CAST[a]!, UNREASONABLES_CAST[b]!];
}

/** A lead explorer wearing one of the 4,320 BITMAP Pixels (used only when no Guardian is awake). */
export function pickExplorer(height: number, seed: number): { name: string; avatar: ToonAvatar } {
  const p = PIXELS[mix(height + 7, seed) % PIXELS.length]!;
  return { name: `${p.name} · explorer of ${height}.bitmap`, avatar: { model: "runner", skin: px(p.id) } };
}

/** Background extras: random BITMAP Pixels that wander the set on a fly brain. */
export function pickExtras(height: number, seed: number, count = 4): string[] {
  return Array.from({ length: count }, (_, i) => PIXELS[mix(height + i * 101, seed + i) % PIXELS.length]!.id);
}

export type CameraPreset = "auto" | "cinematic" | "drone" | "noir" | "action" | "orbit";
export const CAMERA_PRESETS: { v: CameraPreset; label: string }[] = [
  { v: "auto", label: "AUTO · ROLLED" }, { v: "cinematic", label: "Cinematic" }, { v: "drone", label: "Drone" },
  { v: "noir", label: "Dutch Noir" }, { v: "action", label: "Action cuts" }, { v: "orbit", label: "Orbit 360" },
];
export type CameraPlan = { shots: [Shot, Shot, Shot]; transitions: [Transition, Transition]; cams: [LineCam, LineCam, LineCam, LineCam] };
const FIXED: Record<Exclude<CameraPreset, "auto">, CameraPlan> = {
  cinematic: { shots: ["crane", "orbit", "dolly"], transitions: ["iris", "fade"], cams: ["establish", "two", "close", "close"] },
  drone: { shots: ["crane", "wide", "crane"], transitions: ["fade", "iris"], cams: ["establish", "two", "two", "establish"] },
  noir: { shots: ["dutch", "dolly", "dutch"], transitions: ["wipe", "fade"], cams: ["close", "ots", "close", "close"] },
  action: { shots: ["orbit", "dutch", "dolly"], transitions: ["cut", "wipe"], cams: ["close", "two", "ots", "close"] },
  orbit: { shots: ["orbit", "orbit", "orbit"], transitions: ["iris", "fade"], cams: ["two", "close", "two", "two"] },
};
const SHOTS: Shot[] = ["wide", "orbit", "dolly", "dutch", "crane"];
const TRANS: Transition[] = ["iris", "fade", "wipe", "cut"];
const CAMS: LineCam[] = ["close", "two", "ots"];

/** Camera plan for a chapter; "auto" rolls a fresh mix from the seed. The opening line always establishes the land. */
export function cameraPlan(preset: CameraPreset, height: number, seed: number): CameraPlan {
  if (preset !== "auto") return FIXED[preset];
  const r = (i: number) => mix(height + i * 13, seed + i * 7);
  return {
    shots: [SHOTS[r(1) % 5]!, SHOTS[r(2) % 5]!, SHOTS[r(3) % 5]!],
    transitions: [TRANS[r(4) % 4]!, TRANS[r(5) % 4]!],
    cams: ["establish", CAMS[r(6) % 3]!, CAMS[r(7) % 3]!, CAMS[r(8) % 3]!],
  };
}
