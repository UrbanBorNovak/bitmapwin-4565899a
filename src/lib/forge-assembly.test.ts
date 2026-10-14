import { describe, expect, it } from "vitest";
import { encodeParts, forgeAssemblyHtml, parseAssemblyHtml, parseParts, placePart } from "@/lib/forge-assembly";

const ID = "f6b07baf511942564b24dc1816ae9a1ca69e91ceb39a47ccbd27fb05b97ea48bi0";

describe("BWVX_ASM", () => {
  it("round-trips part placements", () => {
    const parts = [{ id: ID, x: 3, y: 1, z: 7, r: 5 }];
    expect(parseParts(encodeParts(parts))).toEqual([{ id: ID, x: 3, y: 1, z: 7, r: 1 }]);
  });
  it("places a part by reference at its offset", () => {
    const out = placePart([{ dx: 10, dy: 2, dz: 10, k: "stone" }], { id: ID, x: 5, y: 0, z: 5, r: 0 });
    expect(out).toEqual([{ dx: 5, dy: 0, dz: 5, k: "stone" }]);
  });
  it("embeds parts in the inscription html, not their voxels", () => {
    const html = forgeAssemblyHtml(417155, [{ id: ID, x: 0, y: 0, z: 0, r: 0 }], []);
    const p = parseAssemblyHtml(html);
    expect(p?.height).toBe(417155);
    expect(p?.parts[0]?.id).toBe(ID);
    expect(p?.own).toBe("");
  });
});
