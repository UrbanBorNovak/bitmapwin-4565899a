import { describe, expect, it } from "vitest";
import { KITS } from "@/lib/forge-kits";
import { blueprintBlocks } from "@/lib/forge-blueprints";
import { cellKey, normaliseModule } from "@/lib/forge-prefabs";
import { forgeBuildViews } from "@/lib/forge-testrun";
import { decodeBuild, encodeBuildBest, forgeInscriptionHtml, FORGE_SPAN_XL } from "@/lib/voxel-populate";
import type { TplBlock } from "@/lib/voxel-populate";
import { forgeDelegateMetadata } from "@/lib/forge-delegate";
import { forgeAssemblyHtml, parseAssemblyHtml } from "@/lib/forge-assembly";
import type { AsmPart } from "@/lib/forge-assembly";

const KIT_IDS = ["kit-citadel", "kit-black-pearl", "kit-giraffe"];

describe("Test Run never changes what gets inscribed or published", () => {
  for (const id of KIT_IDS) {
    const kit = KITS.find((k) => k.id === id)!;
    const world = new Map(blueprintBlocks(kit).map((b) => [cellKey(b.dx, b.dy, b.dz), b]));
    const moving = kit.behaviors.map((b) => blueprintBlocks({ ...kit, steps: b.steps.map((i) => kit.steps[i]!) }));
    const on = forgeBuildViews(world, moving, true);
    const off = forgeBuildViews(world, moving, false);

    describe(kit.name, () => {
      it("hides the moving parts on screen only", () => {
        expect(moving.flat().length).toBeGreaterThan(0);
        expect(on.shown.length).toBe(world.size - new Set(moving.flat().map((b) => cellKey(b.dx, b.dy, b.dz))).size);
        expect(on.payload.length).toBe(world.size);
      });
      it("full 3D inscription is identical", () => {
        expect(forgeInscriptionHtml(1, "studio", on.payload, "")).toBe(forgeInscriptionHtml(1, "studio", off.payload, ""));
      });
      it("Lean delegate metadata is identical", () => {
        expect(forgeDelegateMetadata(1, encodeBuildBest(on.payload, 64).data)).toEqual(forgeDelegateMetadata(1, encodeBuildBest(off.payload, 64).data));
      });
      it("recursive assembly is identical", () => {
        expect(forgeAssemblyHtml(1, [], on.payload, null, "", 64)).toBe(forgeAssemblyHtml(1, [], off.payload, null, "", 64));
      });
      it("published module is identical and keeps every moving block", () => {
        const mod = normaliseModule(on.payload);
        expect(mod).toEqual(normaliseModule(off.payload));
        expect(mod.length).toBe(world.size);
      });
    });
  }
});

describe("Test Run never changes a 128³ XL recursive build", () => {
  const PART: AsmPart = { id: "a".repeat(64) + "i0", x: 100, y: 0, z: 100, r: 1 };
  for (const id of KIT_IDS) {
    const kit = KITS.find((k) => k.id === id)!;
    // Shift the kit past the old 64 edge so it only exists on the XL canvas.
    const shift = (b: TplBlock) => ({ ...b, dx: b.dx + 60, dz: b.dz + 60 });
    const world = new Map(blueprintBlocks(kit).map(shift).map((b) => [cellKey(b.dx, b.dy, b.dz), b]));
    const moving = kit.behaviors.map((b) => blueprintBlocks({ ...kit, steps: b.steps.map((i) => kit.steps[i]!) }).map(shift));
    const on = forgeBuildViews(world, moving, true);
    const off = forgeBuildViews(world, moving, false);
    const htmlOn = forgeAssemblyHtml(1, [PART], on.payload, null, "", FORGE_SPAN_XL);
    const htmlOff = forgeAssemblyHtml(1, [PART], off.payload, null, "", FORGE_SPAN_XL);

    describe(`${kit.name} (XL)`, () => {
      it("really uses space beyond the 64 grid", () => {
        expect(Math.max(...on.payload.map((b) => Math.max(b.dx, b.dz)))).toBeGreaterThanOrEqual(64);
      });
      it("hides moving parts on screen only", () => {
        expect(on.shown.length).toBeLessThan(world.size);
        expect(on.payload.length).toBe(world.size);
      });
      it("recursive XL assembly is identical", () => {
        expect(htmlOn).toBe(htmlOff);
      });
      it("keeps 128 canvas-size metadata and parts", () => {
        const a = parseAssemblyHtml(htmlOn)!;
        const b = parseAssemblyHtml(htmlOff)!;
        expect(a.span).toBe(128);
        expect(b.span).toBe(128);
        expect(a.parts).toEqual([PART]);
        expect(a.parts).toEqual(b.parts);
      });
      it("decoded XL build keeps every animated block", () => {
        const decoded = decodeBuild(parseAssemblyHtml(htmlOn)!.own, FORGE_SPAN_XL);
        const keys = new Set(decoded.map((b) => cellKey(b.dx, b.dy, b.dz)));
        expect(keys.size).toBe(world.size);
        for (const b of moving.flat()) expect(keys.has(cellKey(b.dx, b.dy, b.dz))).toBe(true);
      });
    });
  }
});
