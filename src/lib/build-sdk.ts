/**
 * BITMAP BUILD SDK — @bitmap/build-sdk
 * ------------------------------------
 * Zero-dependency, framework-free contract for everything a builder can put on
 * top of `<height>.bitmap`. A build is `{ kind, config }`; this module owns the
 * kinds, the typed configs, the sanitiser and the inscribe-ready wire format,
 * so a third-party builder can produce a valid build without the marketplace.
 *
 * Wire format (also the inscribe-ready payload):
 *   { p: "bitmap-build", v: 2, bitmap: "<height>.bitmap", kind, config, ... }
 */

export const BUILD_SDK_VERSION = "2.0.0";
export const BUILD_PROTOCOL = "bitmap-build";
export const BUILD_PROTOCOL_VERSION = 2;

export const BUILD_KINDS = ["info", "shop", "gallery", "game3d", "game2d"] as const;
export type BuildKind = (typeof BUILD_KINDS)[number];

export const BUILD_KIND_LABELS: Record<BuildKind, string> = {
  info: "PERSONAL INFO PAGE",
  shop: "ASSET SHOP",
  gallery: "ON-CHAIN GALLERY",
  game3d: "3D WORLD (THREE.JS)",
  game2d: "2D ARCADE",
};

export const BUILD_KIND_HINTS: Record<BuildKind, string> = {
  info: "NAME, ROLE, LOCATION, LINKS — A HOME PAGE FOR THIS BLOCK",
  shop: "LIST YOUR OWN INSCRIPTIONS AT YOUR OWN PRICES — YOUR STORE, YOUR STYLE",
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

/** One asset the holder sells from their own wallet, at their own price. */
export type ShopItem = {
  inscriptionId: string;
  name: string;
  priceSats: number; // 0 = "MAKE OFFER"
  note: string;
  sold: boolean;
};

export type ShopConfig = {
  shopName: string;
  tagline: string;
  /** Where a buyer reaches the seller (x.com, telegram, mail, any https link). */
  contactUrl: string;
  contactLabel: string;
  accent: string; // hex accent for the storefront chrome
  layout: "grid" | "list";
  columns: 2 | 3 | 4;
  frame: "sharp" | "soft";
  items: ShopItem[];
};

/** A 3D asset pulled straight from an ordinals inscription (GLB / GLTF). */
export type Game3dModel = {
  /** Inscription id holding the .glb/.gltf model, served from ordinals.com. */
  inscriptionId: string;
  label: string;
  scale: number; // 0.1..20
  height: number; // -5..20 vertical offset
  spin: boolean;
  /**
   * Optional on-chain image inscription painted onto the model — how the space
   * avatar rig gets its pixel skin. Empty means the model keeps its own texture.
   */
  textureId?: string;
};

export const GAME3D_SCENES = ["city", "monoliths", "pyramids", "rings", "terrain"] as const;
export type Game3dScene = (typeof GAME3D_SCENES)[number];

export const GAME3D_SCENE_LABELS: Record<Game3dScene, string> = {
  city: "VOXEL CITY",
  monoliths: "MONOLITHS",
  pyramids: "PYRAMID FIELD",
  rings: "ORBIT RINGS",
  terrain: "BLOCK TERRAIN",
};

export type Game3dConfig = {
  worldName: string;
  scene: Game3dScene;
  towers: number; // 4..64 structures
  spin: boolean;
  accent: string; // hex
  ground: string; // hex
  grid: boolean;
  fog: boolean;
  /** On-chain 3D models placed at the centre of the world. */
  models: Game3dModel[];
};

export type Game2dConfig = {
  title: string;
  coins: number; // 3..40
  walls: number; // 0..60 (%)
  speed: number; // 1..10
};

export type BuildConfigMap = {
  info: InfoConfig;
  shop: ShopConfig;
  gallery: GalleryConfig;
  game3d: Game3dConfig;
  game2d: Game2dConfig;
};

export type BuildConfig = BuildConfigMap[BuildKind];

export const DEFAULT_CONFIGS: BuildConfigMap = {
  info: { headline: "", fields: [], links: [] },
  shop: {
    shopName: "MY SHOP",
    tagline: "",
    contactUrl: "",
    contactLabel: "CONTACT SELLER",
    accent: "#f7931a",
    layout: "grid",
    columns: 3,
    frame: "sharp",
    items: [],
  },
  gallery: { columns: 3, items: [] },
  game3d: {
    worldName: "BLOCK WORLD",
    scene: "city",
    towers: 24,
    spin: true,
    accent: "#f7931a",
    ground: "#0a0a0a",
    grid: true,
    fog: true,
    models: [],
  },
  game2d: { title: "BLOCK RUN", coins: 12, walls: 22, speed: 5 },
};

/** Documented limits — useful for builder-side validation and UIs. */
export const BUILD_LIMITS = {
  info: { headline: 120, fields: 12, links: 12, label: 40, value: 200, url: 300 },
  shop: {
    items: 60,
    shopName: 60,
    tagline: 140,
    name: 60,
    note: 120,
    inscriptionId: 120,
    url: 300,
    priceSats: [0, 2_100_000_000_000_000] as const,
    columns: [2, 3, 4] as const,
  },
  gallery: { items: 48, inscriptionId: 120, caption: 80, columns: [2, 3, 4] as const },
  game3d: { worldName: 60, towers: [4, 64] as const, models: 6, scale: [0.1, 20] as const },
  game2d: { title: 60, coins: [3, 40] as const, walls: [0, 60] as const, speed: [1, 10] as const },
} as const;


export function isBuildKind(value: unknown): value is BuildKind {
  return typeof value === "string" && (BUILD_KINDS as readonly string[]).includes(value);
}

const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

const hex = (v: unknown, fallback: string) =>
  /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : fallback;

/** Content URL for an inscription — where on-chain 3D models and images live. */
export function inscriptionContentUrl(inscriptionId: string): string {
  return `https://ordinals.com/content/${inscriptionId}`;
}

/** A ready-to-place on-chain 3D asset builders can drop into a world. */
export type OnChainAsset = {
  inscriptionId: string;
  label: string;
  /** Group the asset shows up under in the picker. */
  group: "STRUCTURE" | "AVATAR" | "LANDMARK";
  /** Sensible starting scale for this model in the world. */
  scale: number;
  height: number;
  note?: string;
};

/**
 * Curated GLB/GLTF inscriptions (Draco compressed) that already render well in
 * bitmap worlds — the same on-chain assets used by PATOSHI WORLD × BITMAP PIXELS.
 * Every entry loads straight from the chain via ordinals.com/content.
 */
export const ONCHAIN_ASSETS: OnChainAsset[] = [
  {
    inscriptionId: "7d67e6f807a9898fb9f8cb28e19c58932b02c04ff4da313788f231fe7e00232di0",
    label: "PREBUILD 01",
    group: "STRUCTURE",
    scale: 1,
    height: 0,
  },
  {
    inscriptionId: "e4a74eceffb5e91f543cc5ff8ad0b740794767c981cde9d5f44151c1d0e491a2i0",
    label: "PREBUILD 02",
    group: "STRUCTURE",
    scale: 1,
    height: 0,
  },
  {
    inscriptionId: "d147e7e01b498c71638e19f8ca4b16dcecefe9c2efd3208e7d98ca31c7c983dci0",
    label: "PREBUILD 03",
    group: "STRUCTURE",
    scale: 1.4,
    height: 0,
  },
  {
    inscriptionId: "7f36cae4bfb3ea52dfd1d454e2b16da89deba603988bd2b9415d3a11d24df212i0",
    label: "PREBUILD 04",
    group: "STRUCTURE",
    scale: 1.4,
    height: 0,
  },
  {
    inscriptionId: "e34712cd813b2a0aa7330765c530f29e80cdfc6db6202f24ba87bd2d5819447di0",
    label: "PREBUILD 05",
    group: "STRUCTURE",
    scale: 1.4,
    height: 0,
  },
  {
    inscriptionId: "4f57fb110ffa81b4905e789f337f9469f620a7106815e2f132409312a6770beci0",
    label: "PREBUILD 06",
    group: "STRUCTURE",
    scale: 1.4,
    height: 0,
  },
  {
    inscriptionId: "171c26e24b94e11fc8dfae620173179ff43fa41674685721464ca28d658ed138i0",
    label: "PREBUILD 07",
    group: "STRUCTURE",
    scale: 1.6,
    height: 0,
  },
  {
    inscriptionId: "8e1aae650bd4a716111e2df6f0a81e1089a90da1d2326286486141b042ecb0f0i0",
    label: "MEGA LANDMARK",
    group: "LANDMARK",
    scale: 4,
    height: 0,
    note: "VERY LARGE — RAISE SCALE SLOWLY",
  },
  {
    inscriptionId: "5e2d04efb32bc584af0f86ca9d0744186c680ced298a33235dc913a5f13e2f34i0",
    label: "SPACE AVATAR RIG",
    group: "AVATAR",
    scale: 0.8,
    height: 0,
    note: "ANIMATED CHARACTER — IDLE LOOP PLAYS",
  },
];

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
        items: items
          .slice(0, 48)
          .map((i) => {
            const r = (i ?? {}) as Record<string, unknown>;
            return {
              inscriptionId: str(r["inscriptionId"], 120).trim(),
              caption: str(r["caption"], 80),
            };
          })
          .filter((i) => i.inscriptionId !== ""),
      };
      return config as BuildConfigMap[K];
    }
    case "shop": {
      const items = Array.isArray(o["items"]) ? o["items"] : [];
      const cols = clamp(Number(o["columns"] ?? 3), 2, 4);
      const config: ShopConfig = {
        shopName: str(o["shopName"], 60) || DEFAULT_CONFIGS.shop.shopName,
        tagline: str(o["tagline"], 140),
        contactUrl: str(o["contactUrl"], 300).trim(),
        contactLabel: str(o["contactLabel"], 40) || "CONTACT SELLER",
        accent: /^#[0-9a-fA-F]{6}$/.test(String(o["accent"])) ? String(o["accent"]) : "#f7931a",
        layout: o["layout"] === "list" ? "list" : "grid",
        columns: (cols === 2 || cols === 4 ? cols : 3) as 2 | 3 | 4,
        frame: o["frame"] === "soft" ? "soft" : "sharp",
        items: items
          .slice(0, 60)
          .map((raw) => {
            const r = (raw ?? {}) as Record<string, unknown>;
            const price = Number(r["priceSats"] ?? 0);
            return {
              inscriptionId: str(r["inscriptionId"], 120).trim(),
              name: str(r["name"], 60),
              priceSats: Number.isFinite(price)
                ? Math.max(0, Math.min(2_100_000_000_000_000, Math.round(price)))
                : 0,
              note: str(r["note"], 120),
              sold: r["sold"] === true,
            } satisfies ShopItem;
          })
          .filter((i) => i.inscriptionId !== ""),
      };
      return config as BuildConfigMap[K];
    }
    case "game3d": {
      const models = Array.isArray(o["models"]) ? o["models"] : [];
      const scene = GAME3D_SCENES.includes(o["scene"] as Game3dScene)
        ? (o["scene"] as Game3dScene)
        : "city";
      const config: Game3dConfig = {
        worldName: str(o["worldName"], 60) || DEFAULT_CONFIGS.game3d.worldName,
        scene,
        towers: clamp(Number(o["towers"] ?? 24), 4, 64),
        spin: o["spin"] !== false,
        accent: hex(o["accent"], "#f7931a"),
        ground: hex(o["ground"], "#0a0a0a"),
        grid: o["grid"] !== false,
        fog: o["fog"] !== false,
        models: models
          .slice(0, 6)
          .map((raw) => {
            const r = (raw ?? {}) as Record<string, unknown>;
            const scale = Number(r["scale"] ?? 1);
            const h = Number(r["height"] ?? 0);
            return {
              inscriptionId: str(r["inscriptionId"], 120).trim(),
              label: str(r["label"], 60),
              scale: Number.isFinite(scale) ? Math.min(20, Math.max(0.1, scale)) : 1,
              height: Number.isFinite(h) ? Math.min(20, Math.max(-5, h)) : 0,
              spin: r["spin"] === true,
              textureId: str(r["textureId"], 120).trim(),
            } satisfies Game3dModel;
          })
          .filter((m) => m.inscriptionId !== ""),
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

/** The inscribe-ready wire payload for a build. */
export type BuildPayload<K extends BuildKind = BuildKind> = {
  p: typeof BUILD_PROTOCOL;
  v: typeof BUILD_PROTOCOL_VERSION;
  bitmap: string;
  owner: string | null;
  title: string | null;
  description: string | null;
  link: string | null;
  banner: string | null;
  kind: K;
  config: BuildConfigMap[K];
  district?: { name: string; slug: string };
};

/** Builds a valid, sanitised payload from loose builder input. */
export function createBuildPayload<K extends BuildKind>(input: {
  height: number;
  kind: K;
  config: unknown;
  owner?: string | null;
  title?: string | null;
  description?: string | null;
  link?: string | null;
  banner?: string | null;
  district?: { name: string; slug: string } | null;
}): BuildPayload<K> {
  return {
    p: BUILD_PROTOCOL,
    v: BUILD_PROTOCOL_VERSION,
    bitmap: `${Math.max(0, Math.floor(input.height))}.bitmap`,
    owner: input.owner ?? null,
    title: input.title ?? null,
    description: input.description ?? null,
    link: input.link ?? null,
    banner: input.banner ?? null,
    kind: input.kind,
    config: parseBuildConfig(input.kind, input.config),
    ...(input.district ? { district: input.district } : {}),
  };
}

/** Parses an untrusted payload (e.g. read back from chain) or throws. */
export function parseBuildPayload(raw: unknown): BuildPayload {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (o["p"] !== BUILD_PROTOCOL) throw new Error(`not a ${BUILD_PROTOCOL} payload`);
  if (Number(o["v"]) !== BUILD_PROTOCOL_VERSION) throw new Error(`unsupported version: ${String(o["v"])}`);
  const bitmap = String(o["bitmap"] ?? "");
  const match = /^(\d+)\.bitmap$/.exec(bitmap);
  if (!match) throw new Error(`invalid bitmap name: ${bitmap}`);
  const kind = isBuildKind(o["kind"]) ? o["kind"] : "info";
  const district = o["district"] as { name?: unknown; slug?: unknown } | undefined;
  return {
    p: BUILD_PROTOCOL,
    v: BUILD_PROTOCOL_VERSION,
    bitmap,
    owner: typeof o["owner"] === "string" ? o["owner"] : null,
    title: typeof o["title"] === "string" ? o["title"] : null,
    description: typeof o["description"] === "string" ? o["description"] : null,
    link: typeof o["link"] === "string" ? o["link"] : null,
    banner: typeof o["banner"] === "string" ? o["banner"] : null,
    kind,
    config: parseBuildConfig(kind, o["config"]),
    ...(district && typeof district.name === "string" && typeof district.slug === "string"
      ? { district: { name: district.name, slug: district.slug } }
      : {}),
  };
}

/** Block height a payload targets. */
export function payloadHeight(payload: BuildPayload): number {
  return Number(payload.bitmap.split(".")[0]);
}

/** Deterministic seed for a build: same visuals for every visitor. */
export function buildSeed(height: number, salt = 0): number {
  return Math.abs(Math.floor(height) * 2654435761 + salt) % 2147483647;
}

/* ------------------------------------------------------------------------- *
 * PRESETS — ready-made builds a holder can pick and then adapt.
 * ------------------------------------------------------------------------- */

export type BuildPreset<K extends BuildKind = BuildKind> = {
  id: string;
  name: string;
  blurb: string;
  kind: K;
  config: BuildConfigMap[K];
};

export const BUILD_PRESETS: BuildPreset[] = [
  {
    id: "shop-orange",
    name: "ORANGE STOREFRONT",
    blurb: "BITCOIN-ORANGE SHOP FRONT, 3-UP GRID — IMPORT ASSETS AND PRICE THEM",
    kind: "shop",
    config: {
      shopName: "ORANGE STOREFRONT",
      tagline: "ON-CHAIN ASSETS, PRICED IN SATS, SOLD PEER TO PEER",
      contactUrl: "https://x.com/",
      contactLabel: "DM TO BUY",
      accent: "#f7931a",
      layout: "grid",
      columns: 3,
      frame: "sharp",
      items: [],
    } satisfies ShopConfig,
  },
  {
    id: "shop-mono",
    name: "MONO BOUTIQUE",
    blurb: "STRICT BLACK/WHITE, SOFT FRAMES, 2-UP — FEWER, PRICIER PIECES",
    kind: "shop",
    config: {
      shopName: "MONO BOUTIQUE",
      tagline: "CURATED, ONE-OF-ONE, NO NOISE",
      contactUrl: "",
      contactLabel: "MAKE AN OFFER",
      accent: "#e5e5e5",
      layout: "grid",
      columns: 2,
      frame: "soft",
      items: [],
    } satisfies ShopConfig,
  },
  {
    id: "shop-list",
    name: "PRICE LIST",
    blurb: "DENSE TERMINAL PRICE LIST — GOOD FOR MANY ASSETS AT ONCE",
    kind: "shop",
    config: {
      shopName: "PRICE LIST",
      tagline: "EVERYTHING I HOLD, EVERY PRICE, ONE SCREEN",
      contactUrl: "",
      contactLabel: "CONTACT SELLER",
      accent: "#f7931a",
      layout: "list",
      columns: 3,
      frame: "sharp",
      items: [],
    } satisfies ShopConfig,
  },

  {
    id: "info-card",
    name: "HOLDER CARD",
    blurb: "NAME, ROLE AND LINKS — A CLEAN HOME PAGE FOR THIS BLOCK",
    kind: "info",
    config: {
      headline: "BITCOIN NATIVE, BITMAP HOLDER",
      fields: [
        { label: "ROLE", value: "BUILDER" },
        { label: "LOCATION", value: "ON-CHAIN" },
        { label: "SINCE", value: "2023" },
      ],
      links: [{ label: "X", url: "https://x.com/" }],
    } satisfies InfoConfig,
  },
  {
    id: "info-shop",
    name: "SIGNBOARD",
    blurb: "A SHORT PITCH PLUS CONTACT LINKS — GOOD FOR PROJECTS",
    kind: "info",
    config: {
      headline: "OPEN FOR BUSINESS ON BITCOIN",
      fields: [
        { label: "WHAT", value: "ORDINALS STUDIO" },
        { label: "CONTACT", value: "DM ON X" },
      ],
      links: [
        { label: "SITE", url: "https://" },
        { label: "ORDINALS", url: "https://ordinals.com/" },
      ],
    } satisfies InfoConfig,
  },
  {
    id: "gallery-3",
    name: "GALLERY WALL",
    blurb: "THREE-COLUMN GRID OF ON-CHAIN IMAGES YOU HOLD",
    kind: "gallery",
    config: { columns: 3, items: [] } satisfies GalleryConfig,
  },
  {
    id: "gallery-2",
    name: "SOLO SHOWCASE",
    blurb: "TWO WIDE COLUMNS — BEST FOR A FEW HERO INSCRIPTIONS",
    kind: "gallery",
    config: { columns: 2, items: [] } satisfies GalleryConfig,
  },
  {
    id: "game3d-skyline",
    name: "ORANGE SKYLINE",
    blurb: "WALKABLE VOXEL CITY SEEDED BY THIS BLOCK, BITCOIN ORANGE",
    kind: "game3d",
    config: {
      ...DEFAULT_CONFIGS.game3d,
      worldName: "BLOCK CITY",
      scene: "city",
      towers: 32,
      accent: "#f7931a",
    } satisfies Game3dConfig,
  },
  {
    id: "game3d-mono",
    name: "MONO MONOLITHS",
    blurb: "SPARSE WHITE TOWERS, STATIC CAMERA — MINIMAL AND CALM",
    kind: "game3d",
    config: {
      ...DEFAULT_CONFIGS.game3d,
      worldName: "MONOLITHS",
      scene: "monoliths",
      towers: 12,
      spin: false,
      accent: "#ffffff",
      ground: "#111111",
    } satisfies Game3dConfig,
  },
  {
    id: "game3d-pyramids",
    name: "PYRAMID FIELD",
    blurb: "STEPPED PYRAMIDS ON AN OPEN PLAIN — MONUMENTAL, SLOW ORBIT",
    kind: "game3d",
    config: {
      ...DEFAULT_CONFIGS.game3d,
      worldName: "THE FIELD",
      scene: "pyramids",
      towers: 18,
      accent: "#f7931a",
      fog: true,
    } satisfies Game3dConfig,
  },
  {
    id: "game3d-rings",
    name: "ORBIT RINGS",
    blurb: "BLOCKS ORBITING A CENTRE — DROP AN ORDINALS GLB IN THE MIDDLE",
    kind: "game3d",
    config: {
      ...DEFAULT_CONFIGS.game3d,
      worldName: "ORBIT",
      scene: "rings",
      towers: 40,
      accent: "#f7931a",
      grid: false,
    } satisfies Game3dConfig,
  },
  {
    id: "game3d-terrain",
    name: "BLOCK TERRAIN",
    blurb: "HEIGHTFIELD LANDSCAPE SEEDED BY THE BLOCK — GOOD MODEL STAGE",
    kind: "game3d",
    config: {
      ...DEFAULT_CONFIGS.game3d,
      worldName: "TERRAIN",
      scene: "terrain",
      towers: 24,
      accent: "#f7931a",
      ground: "#0e0e0e",
      fog: true,
    } satisfies Game3dConfig,
  },
  {
    id: "game3d-museum",
    name: "MODEL PLINTH",
    blurb: "EMPTY STAGE BUILT FOR ON-CHAIN 3D MODELS — PASTE A GLB INSCRIPTION",
    kind: "game3d",
    config: {
      ...DEFAULT_CONFIGS.game3d,
      worldName: "PLINTH",
      scene: "rings",
      towers: 6,
      accent: "#e5e5e5",
      grid: true,
      models: [],
    } satisfies Game3dConfig,
  },
  {
    id: "game2d-run",
    name: "BLOCK RUN",
    blurb: "PIXEL MAZE WITH COINS — EASY, FRIENDLY FOR VISITORS",
    kind: "game2d",
    config: { title: "BLOCK RUN", coins: 12, walls: 18, speed: 4 } satisfies Game2dConfig,
  },
  {
    id: "game2d-hard",
    name: "DEEP MAZE",
    blurb: "DENSE WALLS, MORE COINS, FASTER — FOR THE DEGENERATES",
    kind: "game2d",
    config: { title: "DEEP MAZE", coins: 28, walls: 45, speed: 8 } satisfies Game2dConfig,
  },
];

export function presetsForKind(kind: BuildKind): BuildPreset[] {
  return BUILD_PRESETS.filter((p) => p.kind === kind);
}
