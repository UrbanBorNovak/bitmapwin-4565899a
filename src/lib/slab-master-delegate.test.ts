import { describe, it, expect } from "vitest";
import { parseSlabMeta, slabDelegateMetadata, slabMasterHtml } from "@/lib/slab-master-delegate";

const facts = { p: "BW-SLAB-1" as const, h: 840000, hash: null, tx: 3050, grade: 9, name: "MINT", subs: { vintage: 9 }, cert: "BW-840000" };

describe("slab master delegate", () => {
  it("round-trips grade facts through metadata", () => {
    expect(parseSlabMeta(slabDelegateMetadata(facts))?.grade).toBe(9);
  });
  it("refuses metadata from another protocol", () => {
    expect(parseSlabMeta({ ...facts, p: "BITMAPWIN-PET" })).toBeNull();
  });
  it("master reads its own metadata and contains no external hosts", () => {
    const html = slabMasterHtml();
    expect(html).toContain("/r/metadata/");
    expect(html).not.toMatch(/https?:\/\//);
  });
});
