/**
 * Model Registry — the catalogue of on-chain 3D model inscriptions that
 * builders and agents may place. Entries are only inscription ids; every
 * badge shown in the app comes from a live check of the inscribed bytes.
 */
import { RIDES, JETPACK_HELMET_INSCRIPTION } from "@/lib/world-vehicle";

export type ModelCategory = "VEHICLES" | "AVATARS & PETS" | "GEAR";

export type RegistryModel = {
  inscription: string;
  label: string;
  category: ModelCategory;
  /** fitted length in avatar heights, used for the stride estimate */
  fit: number;
};

export const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/;

const PETS = new Set(["cyberpunk-genesis-dog"]);

export const REGISTRY_MODELS: RegistryModel[] = [
  ...RIDES.map((r) => ({
    inscription: r.inscription,
    label: r.label,
    category: (PETS.has(r.id) ? "AVATARS & PETS" : r.worn ? "GEAR" : "VEHICLES") as ModelCategory,
    fit: r.fit,
  })),
  { inscription: JETPACK_HELMET_INSCRIPTION, label: "FLIGHT HELMET", category: "GEAR", fit: 0.4 },
];

export const REGISTRY_CATEGORIES: ModelCategory[] = ["VEHICLES", "AVATARS & PETS", "GEAR"];

/** Agents and AI builders may only place a model that is in this catalogue. */
export function isRegisteredModel(inscription: string) {
  return REGISTRY_MODELS.some((m) => m.inscription === inscription);
}

/** Size in avatar strides (10 strides = one BITMAP across). */
export const stridesFor = (fit: number) => Math.round(fit * 10) / 10;
