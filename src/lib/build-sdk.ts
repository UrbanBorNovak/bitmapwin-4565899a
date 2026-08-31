/**
 * BITMAP BUILD SDK
 * ----------------
 * A build is what a holder puts on top of `<height>.bitmap`. Every build has a
 * `kind` and a typed `config`. This module is the single contract shared by the
 * editor, the renderer and the on-chain export payload, so a third-party
 * builder can produce a valid build JSON without touching the app.
 *
 * Wire format (also the inscribe-ready payload):
 *   { p: "bitmap-build", v: 2, bitmap: "<height>.bitmap", kind, config, ... }
 */

export const BUILD_KINDS = ["info", "gallery", "game3d", "game2d"] as const;
export type BuildKind = (typeof BUILD_KINDS)[number];

export const BUILD_KIND_LABELS: Record<BuildKind, string> = {
  info: "PERSONAL INFO PAGE",
  gallery: "ON-CHAIN GALLERY",
  game3d: "3D WORLD (THREE.JS)",
  game2d: "2D ARCADE",
};

export const BUILD_KIND_HINTS: Record<BuildKind, string> = {
  info: "NAME, ROLE, LOCATION, LINKS — A HOME PAGE FOR THIS BLOCK",
  gallery: "SHOWCASE INSCRIPTION IDS YOU HOLD AS A GRID OF ON-CHAIN IMAGES",
  game3d: "A WALKABLE VOXEL WORLD GENERATED FROM THIS BLOCK'S DATA",
  game2d: "A PIXEL MAZE RUN SEEDED BY THIS BLOCK HEIGHT",
};

export type InfoField = { label: string; value: string };
export type InfoLink = { label: string; url: string };

export type InfoConfig = {
  headline: string;
  fields: InfoField[];
  links: InfoLink[];
};

export type GalleryItem = { inscriptionId: string; caption: string };
export type GalleryConfig = {
  columns: 2 | 3 | 4;
  items: GalleryItem[];
};

export type Game3dConfig = {
  worldName: string;
  towers: number; // 4..64 voxel towers
  spin: boolean;
  accent: string; // hex
};

export type Game2dConfig = {
  title: string;
  coins: number; // 3..40
  walls: number; // 0..60 (%)
  speed: number; // 1..10
};

export type BuildConfigMap = {
  info: InfoConfig;
  gallery: GalleryConfig;
  game3d: Game3dConfig;
  game2d: Game2dConfig;
};

export type BuildConfig = BuildConfigMap[BuildKind];

export const DEFAULT_CONFIGS: BuildConfigMap = {
  info: { headline: "", fields: [], links: [] },
  gallery: { columns: 3, items: [] },
  game3d: { worldName: "BLOCK WORLD", towers: 24, spin: true, accent: "#f7931a" },
  game2d: { title: "BLOCK RUN", coins: 12, walls: 22, speed: 5 },
};

export function isBuildKind(value: unknown): value is BuildKind {
  return typeof value === "string" && (BUILD_KINDS as readonly string[]).includes(value);
}

const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Normalises any untrusted JSON (DB row, pasted SDK payload) into a valid config. */
export function parseBuildConfig<K extends BuildKind>(kind: K, raw: unknown): BuildConfigMap[K] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  switch (kind) {
    case "info": {
      const fields = Array.isArray(o["fields"]) ? o["fields"] : [];
      const links = Array.isArray(o["links"]) ? o["links"] : [];
      const config: InfoConfig = {
        headline: str(o["headline"], 120),
        fields: fields.slice(0, 12).map((f) => {
          const r = (f ?? {}) as Record<string, unknown>;
          return { label: str(r["label"], 40), value: str(r["value"], 200) };
        }),
        links: links.slice(0, 12).map((l) => {
          const r = (l ?? {}) as Record<string, unknown>;
          return { label: str(r["label"], 40), url: str(r["url"], 300) };
        }),
      };
      return config as BuildConfigMap[K];
    }
    case "gallery": {
      const items = Array.isArray(o["items"]) ? o["items"] : [];
      const cols = clamp(Number(o["columns"] ?? 3), 2, 4);
      const config: GalleryConfig = {
        columns: (cols === 2 || cols === 4 ? cols : 3) as 2 | 3 | 4,
        items: items.slice(0, 48).map((i) => {
          const r = (i ?? {}) as Record<string, unknown>;
          return { inscriptionId: str(r["inscriptionId"], 120).trim(), caption: str(r["caption"], 80) };
        }).filter((i) => i.inscriptionId !== ""),
      };
      return config as BuildConfigMap[K];
    }
    case "game3d": {
      const config: Game3dConfig = {
        worldName: str(o["worldName"], 60) || DEFAULT_CONFIGS.game3d.worldName,
        towers: clamp(Number(o["towers"] ?? 24), 4, 64),
        spin: o["spin"] !== false,
        accent: /^#[0-9a-fA-F]{6}$/.test(String(o["accent"])) ? String(o["accent"]) : "#f7931a",
      };
      return config as BuildConfigMap[K];
    }
    default: {
      const config: Game2dConfig = {
        title: str(o["title"], 60) || DEFAULT_CONFIGS.game2d.title,
        coins: clamp(Number(o["coins"] ?? 12), 3, 40),
        walls: clamp(Number(o["walls"] ?? 22), 0, 60),
        speed: clamp(Number(o["speed"] ?? 5), 1, 10),
      };
      return config as BuildConfigMap[K];
    }
  }
}

/** Deterministic PRNG so a build looks identical for every visitor. */
export function seededRandom(seed: number) {
  let s = (seed || 1) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
