import { describe, expect, it } from "vitest";
import { KITS } from "@/lib/forge-kits";
import { blueprintBlocks } from "@/lib/forge-blueprints";
import { cellKey, normaliseModule } from "@/lib/forge-prefabs";
import { forgeBuildViews } from "@/lib/forge-testrun";
import { encodeBuildBest, forgeInscriptionHtml } from "@/lib/voxel-populate";
import { forgeDelegateMetadata } from "@/lib/forge-delegate";
import { forgeAssemblyHtml } from "@/lib/forge-assembly";

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
