/** Slab skins: capsule finish, backplate, land palette and optional foliage. Preview is free. */
export type SlabSkinId = "acrylic" | "gold" | "holo" | "obsidian" | "biome";
export type SlabSkin = {
  id: SlabSkinId; name: string; priceSats: number;
  capsule: { color: string; opacity: number; roughness: number; metalness: number; iridescence: number; transmission: number };
  plate: string; trim: string | null;
  land: { hue: number; sat: number; light: number };
  rainbow: boolean; foliage: boolean;
};
export const SLAB_SKINS: SlabSkin[] = [
  { id: "acrylic", name: "STANDARD ACRYLIC", priceSats: 0, capsule: { color: "#eaf2f5", opacity: 0.35, roughness: 0.04, metalness: 0, iridescence: 0, transmission: 0.96 }, plate: "#0b0f14", trim: null, land: { hue: 0.075, sat: 0.55, light: 0.16 }, rainbow: false, foliage: false },
  { id: "gold", name: "GOLD FOIL", priceSats: 1500, capsule: { color: "#ffe6a8", opacity: 0.4, roughness: 0.08, metalness: 0.2, iridescence: 0.1, transmission: 0.9 }, plate: "#3a2a10", trim: "#d4a017", land: { hue: 0.11, sat: 0.8, light: 0.3 }, rainbow: false, foliage: false },
  { id: "holo", name: "HOLOGRAPHIC", priceSats: 2100, capsule: { color: "#ffffff", opacity: 0.4, roughness: 0.02, metalness: 0.1, iridescence: 1, transmission: 0.95 }, plate: "#10121c", trim: "#c0c8d8", land: { hue: 0, sat: 0.8, light: 0.45 }, rainbow: true, foliage: false },
  { id: "obsidian", name: "PATOSHI OBSIDIAN", priceSats: 3300, capsule: { color: "#2a2a30", opacity: 0.6, roughness: 0.1, metalness: 0.3, iridescence: 0, transmission: 0.6 }, plate: "#050506", trim: "#8a8f98", land: { hue: 0.05, sat: 0.95, light: 0.22 }, rainbow: false, foliage: false },
  { id: "biome", name: "LIVING BIOME", priceSats: 2500, capsule: { color: "#e6f7e8", opacity: 0.3, roughness: 0.05, metalness: 0, iridescence: 0.15, transmission: 0.95 }, plate: "#0d1a10", trim: "#4a7a3a", land: { hue: 0.3, sat: 0.35, light: 0.2 }, rainbow: false, foliage: true },
];
export const slabSkin = (id: string | undefined | null): SlabSkin => SLAB_SKINS.find((s) => s.id === id) ?? SLAB_SKINS[0]!;
