/**
 * BLUEPRINTS — the no-code half of the Studio.
 *
 * A blueprint is a plan of what stands on one BITMAP tile: pieces placed on the
 * 10x10 stride grid the world uses, plus optional quests. It compiles to real
 * SDK v0.2 code (`extender-sdk.ts`), so a blueprint is never a second runtime:
 * the world runs the same sandboxed code it runs for hand-written extenders.
 */

export const BLUEPRINT_GRID = 10;
/** Grid cell centres run from -4.5 to 4.5 strides, 0,0 = tile centre. */
export const BLUEPRINT_HALF = BLUEPRINT_GRID / 2;

export type BlueprintPieceKind =
  | "floor"
  | "wall"
  | "pillar"
  | "tower"
  | "roof"
  | "door"
  | "lamp"
  | "sign"
  | "chest"
  | "tree"
  | "water"
  | "campfire"
  | "statue"
  | "model";

export type BlueprintPieceSpec = {
  kind: BlueprintPieceKind;
  label: string;
  glyph: string;
  shape: "box" | "cylinder" | "sphere" | "cone" | "plane";
  w: number;
  h: number;
  d: number;
  y: number;
  color: string;
  glow: boolean;
  interactive: boolean;
  note: string;
};

export const BLUEPRINT_PIECES: BlueprintPieceSpec[] = [
  { kind: "floor", label: "FLOOR", glyph: "▦", shape: "box", w: 1, h: 0.12, d: 1, y: 0.06, color: "#3a3630", glow: false, interactive: false, note: "Paved ground" },
  { kind: "wall", label: "WALL", glyph: "▮", shape: "box", w: 1, h: 2.2, d: 0.25, y: 1.1, color: "#57504a", glow: false, interactive: false, note: "Straight wall segment" },
  { kind: "pillar", label: "PILLAR", glyph: "▯", shape: "cylinder", w: 0.5, h: 3, d: 0.5, y: 1.5, color: "#6b6258", glow: false, interactive: false, note: "Column" },
  { kind: "tower", label: "TOWER", glyph: "⌂", shape: "cylinder", w: 1.6, h: 7, d: 1.6, y: 3.5, color: "#5d544a", glow: false, interactive: false, note: "Tall structure" },
  { kind: "roof", label: "ROOF", glyph: "△", shape: "cone", w: 1.8, h: 1.4, d: 1.8, y: 2.6, color: "#7a4a2a", glow: false, interactive: false, note: "Cap a wall ring" },
  { kind: "door", label: "DOOR", glyph: "◫", shape: "box", w: 0.9, h: 1.8, d: 0.2, y: 0.9, color: "#8a5a28", glow: false, interactive: true, note: "Interactive entrance" },
  { kind: "lamp", label: "LAMP", glyph: "✦", shape: "sphere", w: 0.5, h: 0.5, d: 0.5, y: 2.4, color: "#f7931a", glow: true, interactive: false, note: "Glowing light" },
  { kind: "sign", label: "SIGN", glyph: "▤", shape: "box", w: 0.9, h: 0.6, d: 0.1, y: 1.4, color: "#d8cdbb", glow: false, interactive: true, note: "Carries a label" },
  { kind: "chest", label: "CHEST", glyph: "▣", shape: "box", w: 0.7, h: 0.5, d: 0.5, y: 0.25, color: "#9b6b2a", glow: false, interactive: true, note: "Interactive container" },
  { kind: "tree", label: "TREE", glyph: "↑", shape: "cone", w: 1.4, h: 3.4, d: 1.4, y: 1.8, color: "#2f6b45", glow: false, interactive: false, note: "Greenery" },
  { kind: "water", label: "WATER", glyph: "≈", shape: "plane", w: 1, h: 0.05, d: 1, y: 0.04, color: "#1f6b8a", glow: false, interactive: false, note: "Pond or channel" },
  { kind: "campfire", label: "FIRE", glyph: "✸", shape: "cone", w: 0.7, h: 0.8, d: 0.7, y: 0.4, color: "#ff6a1a", glow: true, interactive: true, note: "Gathering point" },
  { kind: "statue", label: "STATUE", glyph: "☖", shape: "box", w: 0.7, h: 2.4, d: 0.7, y: 1.2, color: "#8d8778", glow: false, interactive: true, note: "Monument" },
  { kind: "model", label: "ON-CHAIN", glyph: "◈", shape: "box", w: 1.2, h: 1.2, d: 1.2, y: 0.6, color: "#00e0ff", glow: true, interactive: false, note: "Inscribed 3D model" },
];

export function pieceSpec(kind: BlueprintPieceKind): BlueprintPieceSpec {
  return BLUEPRINT_PIECES.find((p) => p.kind === kind) ?? BLUEPRINT_PIECES[0]!;
}

export type BlueprintPiece = {
  id: string;
  kind: BlueprintPieceKind;
  /** grid cell, 0..BLUEPRINT_GRID-1 */
  gx: number;
  gz: number;
  rotationY: number;
  scale: number;
  color: string | null;
  label: string | null;
  inscriptionId: string | null;
};

export type BlueprintQuest = {
  id: string;
  title: string;
  detail: string;
  reward: string;
};

export type Blueprint = {
  version: 1;
  name: string;
  pieces: BlueprintPiece[];
  quests: BlueprintQuest[];
};

export const EMPTY_BLUEPRINT: Blueprint = { version: 1, name: "", pieces: [], quests: [] };

export const BLUEPRINT_MAX_PIECES = 160;

/** Grid cell -> tile-local stride coordinate (cell centre). */
export function cellToStride(cell: number): number {
  return cell + 0.5 - BLUEPRINT_HALF;
}

export function pieceKey(gx: number, gz: number): string {
  return `${gx}:${gz}`;
}

function q(value: string): string {
  return JSON.stringify(value);
}

function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** Compile the plan into SDK v0.2 code the sandbox runs unchanged. */
export function codeFromBlueprint(blueprint: Blueprint): string {
  const lines: string[] = [];
  lines.push(`// ${(blueprint.name || "BLUEPRINT").toUpperCase()} — drawn in the Studio blueprint editor.`);
  lines.push(`// ${blueprint.pieces.length} pieces on the 10x10 stride grid. Edit freely; the editor can reload it.`);
  lines.push("");
  for (const piece of blueprint.pieces) {
    const spec = pieceSpec(piece.kind);
    const x = cellToStride(piece.gx);
    const z = cellToStride(piece.gz);
    const s = piece.scale;
    if (piece.kind === "model" && piece.inscriptionId) {
      lines.push(
        `world.model({ inscriptionId: ${q(piece.inscriptionId)}, x: ${num(x)}, z: ${num(z)}, y: ${num(spec.y * s)}, w: ${num(spec.w * s)}, rotationY: ${num(piece.rotationY)} });`,
      );
      continue;
    }
    const parts = [
      `shape: ${q(spec.shape)}`,
      `x: ${num(x)}`,
      `z: ${num(z)}`,
      `y: ${num(spec.y * s)}`,
      `w: ${num(spec.w * s)}`,
      `h: ${num(spec.h * s)}`,
      `d: ${num(spec.d * s)}`,
      `color: ${q(piece.color ?? spec.color)}`,
      `rotationY: ${num(piece.rotationY)}`,
    ];
    if (spec.glow) parts.push("glow: true");
    if (spec.interactive) parts.push("interactive: true");
    if (piece.label) parts.push(`label: ${q(piece.label)}`);
    lines.push(`world.prop({ ${parts.join(", ")} });`);
  }
  if (blueprint.quests.length > 0) {
    lines.push("");
    for (const quest of blueprint.quests) {
      lines.push(
        `quest.add({ id: ${q(quest.id)}, title: ${q(quest.title)}, detail: ${q(quest.detail)}, reward: ${q(quest.reward)} });`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Read a blueprint back out of a published version manifest. */
export function blueprintFromManifest(manifest: unknown): Blueprint | null {
  if (!manifest || typeof manifest !== "object") return null;
  const raw = (manifest as Record<string, unknown>)["blueprint"];
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const pieces = Array.isArray(record["pieces"]) ? (record["pieces"] as unknown[]) : [];
  const quests = Array.isArray(record["quests"]) ? (record["quests"] as unknown[]) : [];
  const parsedPieces: BlueprintPiece[] = [];
  for (const entry of pieces) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry as Record<string, unknown>;
    const kind = String(p["kind"] ?? "");
    if (!BLUEPRINT_PIECES.some((spec) => spec.kind === kind)) continue;
    const gx = Number(p["gx"]);
    const gz = Number(p["gz"]);
    if (!Number.isInteger(gx) || !Number.isInteger(gz)) continue;
    parsedPieces.push({
      id: String(p["id"] ?? `${kind}-${gx}-${gz}`),
      kind: kind as BlueprintPieceKind,
      gx: Math.min(BLUEPRINT_GRID - 1, Math.max(0, gx)),
      gz: Math.min(BLUEPRINT_GRID - 1, Math.max(0, gz)),
      rotationY: Number.isFinite(Number(p["rotationY"])) ? Number(p["rotationY"]) : 0,
      scale: Number.isFinite(Number(p["scale"])) ? Number(p["scale"]) : 1,
      color: typeof p["color"] === "string" ? p["color"] : null,
      label: typeof p["label"] === "string" ? p["label"] : null,
      inscriptionId: typeof p["inscriptionId"] === "string" ? p["inscriptionId"] : null,
    });
  }
  const parsedQuests: BlueprintQuest[] = [];
  for (const entry of quests) {
    if (!entry || typeof entry !== "object") continue;
    const qv = entry as Record<string, unknown>;
    const title = String(qv["title"] ?? "").trim();
    if (!title) continue;
    parsedQuests.push({
      id: String(qv["id"] ?? title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")),
      title,
      detail: String(qv["detail"] ?? ""),
      reward: String(qv["reward"] ?? ""),
    });
  }
  return {
    version: 1,
    name: typeof record["name"] === "string" ? record["name"] : "",
    pieces: parsedPieces,
    quests: parsedQuests,
  };
}

export function blueprintSummary(blueprint: Blueprint): string {
  const counts = new Map<BlueprintPieceKind, number>();
  for (const piece of blueprint.pieces) counts.set(piece.kind, (counts.get(piece.kind) ?? 0) + 1);
  const parts = [...counts.entries()].map(([kind, n]) => `${n}× ${pieceSpec(kind).label}`);
  if (blueprint.quests.length > 0) parts.push(`${blueprint.quests.length}× QUEST`);
  return parts.join(" · ");
}
