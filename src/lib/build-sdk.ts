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

export const BUILD_KINDS = ["info", "shop", "gallery", "game3d", "game2d", "myspace"] as const;
export type BuildKind = (typeof BUILD_KINDS)[number];

export const BUILD_KIND_LABELS: Record<BuildKind, string> = {
  info: "PERSONAL INFO PAGE",
  shop: "ASSET SHOP",
  gallery: "ON-CHAIN GALLERY",
  game3d: "3D WORLD (THREE.JS)",
  game2d: "2D ARCADE",
  myspace: "MYSPACE '06 PROFILE",
};

export const BUILD_KIND_HINTS: Record<BuildKind, string> = {
  info: "NAME, ROLE, LOCATION, LINKS — A HOME PAGE FOR THIS BLOCK",
  shop: "LIST YOUR OWN INSCRIPTIONS AT YOUR OWN PRICES — YOUR STORE, YOUR STYLE",
  gallery: "SHOWCASE INSCRIPTION IDS YOU HOLD AS A GRID OF ON-CHAIN IMAGES",
  game3d: "A WALKABLE VOXEL WORLD GENERATED FROM THIS BLOCK'S DATA",
  game2d: "A PIXEL MAZE RUN SEEDED BY THIS BLOCK HEIGHT",
  myspace: "MOOD, PROFILE SONG, TOP 8 BITMAPS AND A GUESTBOOK — 2006 NOSTALGIA",
};

/* ------------------------------------------------------------------------- *
 * THEME — the artistic layer every flat build kind shares.
 * ------------------------------------------------------------------------- */

export const BUILD_SURFACES = ["void", "slate", "paper", "sepia"] as const;
export type BuildSurface = (typeof BUILD_SURFACES)[number];

export const BUILD_SURFACE_LABELS: Record<BuildSurface, string> = {
  void: "VOID BLACK",
  slate: "SLATE",
  paper: "PAPER WHITE",
  sepia: "SEPIA",
};

export const BUILD_FRAMES = ["sharp", "soft", "round"] as const;
export type BuildFrame = (typeof BUILD_FRAMES)[number];

export const BUILD_FRAME_LABELS: Record<BuildFrame, string> = {
  sharp: "SHARP",
  soft: "SOFT",
  round: "ROUND",
};

/** Look and feel a builder controls freely — colour, surface, frame, glow. */
export type BuildTheme = {
  accent: string;
  surface: BuildSurface;
  frame: BuildFrame;
  /** Accent glow around the build shell — pure decoration. */
  glow: boolean;
  /** Show a thin accent rule under headings. */
  rules: boolean;
};

export const DEFAULT_THEME: BuildTheme = {
  accent: "#f7931a",
  surface: "void",
  frame: "sharp",
  glow: false,
  rules: true,
};

const SURFACE_BG: Record<BuildSurface, string> = {
  void: "#0a0a0a",
  slate: "#17181a",
  paper: "#f2efe9",
  sepia: "#efe3d0",
};

const SURFACE_FG: Record<BuildSurface, string> = {
  void: "#f5f5f5",
  slate: "#f2f2f2",
  paper: "#121212",
  sepia: "#241a10",
};

const FRAME_RADIUS: Record<BuildFrame, string> = {
  sharp: "0px",
  soft: "8px",
  round: "22px",
};

/** Inline style for a themed build shell — renderers stay token-free. */
export function themeShellStyle(theme: BuildTheme): Record<string, string> {
  return {
    background: SURFACE_BG[theme.surface],
    color: SURFACE_FG[theme.surface],
    borderColor: `${theme.accent}66`,
    borderRadius: FRAME_RADIUS[theme.frame],
    ...(theme.glow ? { boxShadow: `0 0 0 1px ${theme.accent}33, 0 18px 60px -24px ${theme.accent}` } : {}),
  };
}

/** Inline style for a themed panel inside a build shell. */
export function themePanelStyle(theme: BuildTheme): Record<string, string> {
  return {
    borderColor: `${theme.accent}44`,
    borderRadius: FRAME_RADIUS[theme.frame],
  };
}

/** One-click artistic palettes: accent + ground, ready for any build kind. */
export const ART_PALETTES: {
  id: string;
  name: string;
  accent: string;
  ground: string;
  surface: BuildSurface;
}[] = [
  { id: "orange", name: "BITCOIN ORANGE", accent: "#f7931a", ground: "#0a0a0a", surface: "void" },
  { id: "mono", name: "PURE MONO", accent: "#ffffff", ground: "#111111", surface: "void" },
  { id: "ember", name: "EMBER", accent: "#e85d3a", ground: "#1a1a1a", surface: "slate" },
  { id: "gold", name: "NOIR GOLD", accent: "#c9a84c", ground: "#0d0d0d", surface: "void" },
  { id: "mint", name: "TERMINAL MINT", accent: "#2dd4a8", ground: "#0d1b2a", surface: "slate" },
  { id: "ice", name: "COLD STEEL", accent: "#6ba3c8", ground: "#101418", surface: "slate" },
  { id: "paper", name: "PAPER & INK", accent: "#2d2d2d", ground: "#f2efe9", surface: "paper" },
  { id: "sepia", name: "OLD MAP", accent: "#8b5a2b", ground: "#efe3d0", surface: "sepia" },
];

export type InfoField = { label: string; value: string };
export type InfoLink = { label: string; url: string };

export type InfoConfig = {
  headline: string;
  /** Optional second line under the headline — room for a manifesto. */
  subline: string;
  fields: InfoField[];
  links: InfoLink[];
  theme: BuildTheme;
};

export type GalleryItem = { inscriptionId: string; caption: string };
export type GalleryConfig = {
  columns: 2 | 3 | 4;
  /** How each image sits in its frame. */
  fit: "contain" | "cover";
  /** Grayscale until hover — a gallerist's trick. */
  monochrome: boolean;
  items: GalleryItem[];
  theme: BuildTheme;
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

export const MYSPACE_SKINS = ["classic", "cyber", "glitter"] as const;
export type MyspaceSkin = (typeof MYSPACE_SKINS)[number];
export const MYSPACE_SKIN_LABELS: Record<MyspaceSkin, string> = {
  classic: "CLASSIC BLUE '06",
  cyber: "CYBER 95",
  glitter: "GLITTER GOLD",
};

/** One Top 8 slot: another BITMAP the holder features, with a nickname. */
export type MyspaceFriend = { height: number; nickname: string };

export type MyspaceConfig = {
  displayName: string;
  /** Quote under the profile picture. */
  quote: string;
  mood: string;
  /** "Currently listening to" line and the optional on-chain audio inscription. */
  songTitle: string;
  songInscriptionId: string;
  /** Flashbox: optional video — an on-chain video inscription id or a YouTube link. */
  videoTitle: string;
  videoSource: string;
  /** Optional on-chain image inscription used as the profile picture. */
  avatarInscriptionId: string;
  aboutMe: string;
  wantToMeet: string;
  interests: string;
  top8: MyspaceFriend[];
  skin: MyspaceSkin;
};

export type BuildConfigMap = {
  info: InfoConfig;
  shop: ShopConfig;
  gallery: GalleryConfig;
  game3d: Game3dConfig;
  game2d: Game2dConfig;
  myspace: MyspaceConfig;
};

export type BuildConfig = BuildConfigMap[BuildKind];

export const DEFAULT_CONFIGS: BuildConfigMap = {
  info: { headline: "", subline: "", fields: [], links: [], theme: DEFAULT_THEME },
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
  gallery: {
    columns: 3,
    fit: "contain",
    monochrome: false,
    items: [],
    theme: DEFAULT_THEME,
  },
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
  myspace: {
    displayName: "",
    quote: "",
    mood: "",
    songTitle: "",
    songInscriptionId: "",
    videoTitle: "",
    videoSource: "",
    avatarInscriptionId: "",
    aboutMe: "",
    wantToMeet: "",
    interests: "",
    top8: [],
    skin: "classic",
  },
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
  myspace: { displayName: 60, quote: 140, mood: 60, songTitle: 80, inscriptionId: 120, about: 2000, interests: 600, top8: 8, nickname: 24 },
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
  /** True when the asset accepts an on-chain image skin (AVATAR_SKINS). */
  skinnable?: boolean;
};

/** The animated space avatar rig — the one asset that takes a pixel skin. */
export const AVATAR_RIG_ID =
  "5e2d04efb32bc584af0f86ca9d0744186c680ced298a33235dc913a5f13e2f34i0";

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
    inscriptionId: AVATAR_RIG_ID,
    label: "SPACE AVATAR RIG",
    group: "AVATAR",
    scale: 0.8,
    height: 0,
    note: "ANIMATED CHARACTER — PICK A SKIN BELOW",
    skinnable: true,
  },
];

/**
 * On-chain pixel skins for the space avatar rig. Each one is an image
 * inscription mapped onto the rig's body material.
 */
export const AVATAR_SKINS: { inscriptionId: string; label: string }[] = [
  { inscriptionId: "e4d14cac0179c85a6285bb31f7af2e9f741a324f98f5cba9f806493309714507i0", label: "SKIN 01" },
  { inscriptionId: "bfd378b86fb230a26a9cffc23b427146de76eefb9fc1d6649fe7477dc4be53ddi0", label: "SKIN 02" },
  { inscriptionId: "f9f64471e1fed505e31f90ec445c576219b9cba5b2646effd05d5e36c5e1b788i0", label: "SKIN 03" },
  { inscriptionId: "0407fe2c0b080a9ed27b3b3a07d40f2106b3b6dbe973e49d3525a6001f63c8e9i0", label: "SKIN 04" },
  { inscriptionId: "0701ed49ac70544e4d0909c94a5c910a0bf6bc948c20330732ac910206a08388i0", label: "SKIN 05" },
  { inscriptionId: "80367c008deb077805e247ce722911cf706e9df70cdfba01988c57eaa50caab6i0", label: "SKIN 06" },
  { inscriptionId: "cc06642fa13f760151e53804792c724fe3ffe38858b91f189f8d3439b282248bi0", label: "SKIN 07" },
  { inscriptionId: "b95af2eeed5175622f49c992305cc02b790c20d834a965b20a040f59a3bab227i0", label: "SKIN 08" },
  { inscriptionId: "6de302a4ca5d571cb48e64c408fe8243151f350bf0afefd369bab6f18d2041d1i0", label: "SKIN 09" },
  { inscriptionId: "ef83cdeff41b74a8a5425862b9bcc1ca2085430137cab0e657142200346a922di0", label: "SKIN 10" },
  { inscriptionId: "58b74905b0b40799e7791f2ed7b09595f9aee937d82084a85ef8173895c36a67i0", label: "SKIN 11" },
  { inscriptionId: "cab9edf662a551d1de8993e04d5564197c0eb9575fd88dd28f4496b9d273d4f3i0", label: "SKIN 12" },
  { inscriptionId: "bca9d8951361f077232115100939bc51c8ffa1ead67ab3e1a989912171f38996i0", label: "SKIN 13" },
  { inscriptionId: "bff6ff4d9fc51fa9826b83267c0256236d9c2391a7e30323e5d38004d0e0047di0", label: "SKIN 14" },
  { inscriptionId: "22e4ed36864569041cf57dd65512719b7655fae69ddfd07a5fab0148770c5dfei0", label: "SKIN 15" },
  { inscriptionId: "7b32e098b565c79f217ce2dac18d8e621add81ce3c5fbae1e221c4a0f0679705i0", label: "SKIN 16" },
];

/** Normalises an untrusted theme object, falling back to the house style. */
export function parseTheme(raw: unknown): BuildTheme {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    accent: hex(o["accent"], DEFAULT_THEME.accent),
    surface: BUILD_SURFACES.includes(o["surface"] as BuildSurface)
      ? (o["surface"] as BuildSurface)
      : DEFAULT_THEME.surface,
    frame: BUILD_FRAMES.includes(o["frame"] as BuildFrame)
      ? (o["frame"] as BuildFrame)
      : DEFAULT_THEME.frame,
    glow: o["glow"] === true,
    rules: o["rules"] !== false,
  };
}

/** Normalises any untrusted JSON (DB row, pasted SDK payload) into a valid config. */
export function parseBuildConfig<K extends BuildKind>(kind: K, raw: unknown): BuildConfigMap[K] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  switch (kind) {
    case "info": {
      const fields = Array.isArray(o["fields"]) ? o["fields"] : [];
      const links = Array.isArray(o["links"]) ? o["links"] : [];
      const config: InfoConfig = {
        theme: parseTheme(o["theme"]),
        subline: str(o["subline"], 240),
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
        theme: parseTheme(o["theme"]),
        fit: o["fit"] === "cover" ? "cover" : "contain",
        monochrome: o["monochrome"] === true,
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
    case "myspace": {
      const top8 = Array.isArray(o["top8"]) ? o["top8"] : [];
      const skin = MYSPACE_SKINS.includes(o["skin"] as MyspaceSkin) ? (o["skin"] as MyspaceSkin) : "classic";
      const config: MyspaceConfig = {
        displayName: str(o["displayName"], 60),
        quote: str(o["quote"], 140),
        mood: str(o["mood"], 60),
        songTitle: str(o["songTitle"], 80),
        songInscriptionId: str(o["songInscriptionId"], 120).trim(),
        videoTitle: str(o["videoTitle"], 80),
        videoSource: str(o["videoSource"], 200).trim(),
        avatarInscriptionId: str(o["avatarInscriptionId"], 120).trim(),
        aboutMe: str(o["aboutMe"], 2000),
        wantToMeet: str(o["wantToMeet"], 2000),
        interests: str(o["interests"], 600),
        top8: top8
          .slice(0, 8)
          .map((f) => {
            const r = (f ?? {}) as Record<string, unknown>;
            const h = Number(r["height"]);
            return { height: Number.isInteger(h) && h >= 0 ? h : -1, nickname: str(r["nickname"], 24) };
          })
          .filter((f) => f.height >= 0),
        skin,
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
      subline: "",
      fields: [
        { label: "ROLE", value: "BUILDER" },
        { label: "LOCATION", value: "ON-CHAIN" },
        { label: "SINCE", value: "2023" },
      ],
      links: [{ label: "X", url: "https://x.com/" }],
      theme: DEFAULT_THEME,
    } satisfies InfoConfig,
  },
  {
    id: "info-shop",
    name: "SIGNBOARD",
    blurb: "A SHORT PITCH PLUS CONTACT LINKS — GOOD FOR PROJECTS",
    kind: "info",
    config: {
      headline: "OPEN FOR BUSINESS ON BITCOIN",
      subline: "",
      fields: [
        { label: "WHAT", value: "ORDINALS STUDIO" },
        { label: "CONTACT", value: "DM ON X" },
      ],
      links: [
        { label: "SITE", url: "https://" },
        { label: "ORDINALS", url: "https://ordinals.com/" },
      ],
      theme: DEFAULT_THEME,
    } satisfies InfoConfig,
  },
  {
    id: "info-manifesto",
    name: "MANIFESTO",
    blurb: "BIG STATEMENT ON PAPER WHITE — TYPOGRAPHY FIRST, NEARLY NO CHROME",
    kind: "info",
    config: {
      headline: "THIS BLOCK IS MINE",
      subline: "A PLACE ON BITCOIN THAT CANNOT BE DELETED, RENTED BACK OR CENSORED.",
      fields: [],
      links: [],
      theme: { accent: "#2d2d2d", surface: "paper", frame: "sharp", glow: false, rules: true },
    } satisfies InfoConfig,
  },
  {
    id: "gallery-3",
    name: "GALLERY WALL",
    blurb: "THREE-COLUMN GRID OF ON-CHAIN IMAGES YOU HOLD",
    kind: "gallery",
    config: {
      columns: 3,
      fit: "contain",
      monochrome: false,
      items: [],
      theme: DEFAULT_THEME,
    } satisfies GalleryConfig,
  },
  {
    id: "gallery-2",
    name: "SOLO SHOWCASE",
    blurb: "TWO WIDE COLUMNS — BEST FOR A FEW HERO INSCRIPTIONS",
    kind: "gallery",
    config: {
      columns: 2,
      fit: "contain",
      monochrome: false,
      items: [],
      theme: DEFAULT_THEME,
    } satisfies GalleryConfig,
  },
  {
    id: "gallery-museum",
    name: "WHITE CUBE",
    blurb: "MUSEUM WALL — PAPER WHITE, ROUND FRAMES, GRAYSCALE UNTIL HOVER",
    kind: "gallery",
    config: {
      columns: 3,
      fit: "contain",
      monochrome: true,
      items: [],
      theme: { accent: "#2d2d2d", surface: "paper", frame: "round", glow: false, rules: false },
    } satisfies GalleryConfig,
  },
  {
    id: "gallery-neon",
    name: "NEON VAULT",
    blurb: "COVER-CROPPED 4-UP GRID WITH AN ACCENT GLOW — LOUD AND MODERN",
    kind: "gallery",
    config: {
      columns: 4,
      fit: "cover",
      monochrome: false,
      items: [],
      theme: { accent: "#2dd4a8", surface: "slate", frame: "soft", glow: true, rules: true },
    } satisfies GalleryConfig,
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

const MYSPACE_PRESETS: BuildPreset[] = [
  {
    id: "myspace-classic",
    name: "TOM'S CLASSIC",
    blurb: "THE ORIGINAL LIGHT-BLUE TABLES — EVERYONE'S FIRST FRIEND",
    kind: "myspace",
    config: { ...DEFAULT_CONFIGS.myspace, skin: "classic", mood: "STACKING SATS", quote: "DON'T TRUST, VERIFY." } satisfies MyspaceConfig,
  },
  {
    id: "myspace-cyber",
    name: "CYBER 95",
    blurb: "DARK TERMINAL, NEON ORANGE TABLES",
    kind: "myspace",
    config: { ...DEFAULT_CONFIGS.myspace, skin: "cyber", mood: "HODLING" } satisfies MyspaceConfig,
  },
  {
    id: "myspace-glitter",
    name: "GLITTER GOLD",
    blurb: "SPARKLY GOLD BORDERS — MAXIMUM 2006",
    kind: "myspace",
    config: { ...DEFAULT_CONFIGS.myspace, skin: "glitter", mood: "FEELING BLOCKY" } satisfies MyspaceConfig,
  },
];

export function presetsForKind(kind: BuildKind): BuildPreset[] {
  return [...BUILD_PRESETS, ...MYSPACE_PRESETS].filter((p) => p.kind === kind);
}

/** What a Flashbox source points to: an on-chain inscription, a YouTube video, or nothing usable. */
export type FlashboxSource =
  | { type: "inscription"; id: string }
  | { type: "youtube"; id: string }
  | null;

/** Only inscription ids and YouTube links are accepted; anything else plays nothing. */
export function flashboxSource(raw: string): FlashboxSource {
  const v = raw.trim();
  if (!v) return null;
  const insc = v.match(/(?:^|\/)([0-9a-f]{64}i\d+)$/i);
  if (insc) return { type: "inscription", id: (insc[1] ?? "").toLowerCase() };
  const yt =
    v.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/) ??
    v.match(/^(?:https?:\/\/)?youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (yt) return { type: "youtube", id: yt[1] ?? "" };
  return null;
}
