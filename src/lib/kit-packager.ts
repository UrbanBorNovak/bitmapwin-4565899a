/**
 * Community kit packager: slices a canvas build into numbered bags/steps
 * bottom-up (like a real booklet) so any build can ship as a boxed kit.
 */
import type { TplBlock } from "@/lib/voxel-templates";
import type { BehaviorCard, Kit, KitBehavior } from "@/lib/forge-kits";

export const KIT_PUBLISH_SATS = 1000;
export const KIT_MIN_BLOCKS = 40;
export const KIT_MAX_BLOCKS = 8000;

const TITLES = ["Foundation", "Lower walls", "Main body", "Upper floors", "Roof line", "Towers & spires", "Crown details", "Final touches"];

/** Sort bottom-up (then by x,z) and cut into `bags` near-equal steps. */
export function sliceIntoSteps(blocks: TplBlock[], bags: number) {
  const n = Math.max(1, Math.min(8, Math.floor(bags), blocks.length));
  const sorted = [...blocks].sort((a, b) => a.dy - b.dy || a.dx - b.dx || a.dz - b.dz);
  const size = Math.ceil(sorted.length / n);
  const steps: { title: string; tip: string; blocks: TplBlock[] }[] = [];
  for (let i = 0; i < n; i++) {
    const part = sorted.slice(i * size, (i + 1) * size);
    if (!part.length) break;
    const t = TITLES[Math.round((i / Math.max(1, n - 1)) * (TITLES.length - 1))]!;
    steps.push({ title: t, tip: `Layers ${part[0]!.dy}–${part[part.length - 1]!.dy} · ${part.length} bricks`, blocks: part });
  }
  return steps;
}

export const MAX_KIT_BEHAVIORS = 4;
export type TaggedPart = { card: BehaviorCard; step: number };

/** Turns a creator's tag (card + bag) into a playable behavior pivoting at that bag's base centre. */
export function tagToBehavior(tag: TaggedPart, steps: { blocks: TplBlock[] }[]): KitBehavior | null {
  const blocks = steps[tag.step]?.blocks;
  if (!blocks?.length) return null;
  let x0 = 99, x1 = -1, z0 = 99, z1 = -1, y0 = 99;
  for (const b of blocks) { x0 = Math.min(x0, b.dx); x1 = Math.max(x1, b.dx); z0 = Math.min(z0, b.dz); z1 = Math.max(z1, b.dz); y0 = Math.min(y0, b.dy); }
  const pivot: [number, number, number] = [Math.round((x0 + x1) / 2), y0, Math.round((z0 + z1) / 2)];
  const out: KitBehavior = { card: tag.card, steps: [tag.step], pivot };
  if (tag.card === "train_loop") { out.path = [[0, 0], [8, 0], [8, 8], [0, 8], [0, 0]]; out.speed = 4; }
  return out;
}

export type CommunityKitRow = {
  id: string; name: string; tagline: string; difficulty: string; maker_address: string;
  steps: { title: string; tip: string; blocks: TplBlock[] }[]; bags: number[]; block_count: number; behaviors?: KitBehavior[];
};

export function rowToKit(r: CommunityKitRow): Kit & { maker: string } {
  return {
    id: `ck-${r.id}`, name: r.name, sphere: "community", kit: true,
    difficulty: (["BEGINNER", "BUILDER", "MASTER"].includes(r.difficulty) ? r.difficulty : "BUILDER") as Kit["difficulty"],
    story: r.tagline, tagline: r.tagline, ages: "ALL AGES", behaviors: (r.behaviors ?? []).filter((b) => r.steps[b.steps[0] ?? -1]),
    bags: r.bags, steps: r.steps.map((s) => ({ ...s, parts: [] })), maker: r.maker_address,
  };
}
