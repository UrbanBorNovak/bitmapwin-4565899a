import { describe, expect, it } from "vitest";
import { archiveGeometryFor, convertBackupBuild } from "./inscribed-space-archive";

describe("Inscribed.space archive", () => {
  it("keeps only ordinals.com models", () => {
    const g = convertBackupBuild({
      model: [
        { p: { x: 1, y: 2, z: 3 }, s: { x: 2, y: 2, z: 2 }, asset: `https://ordinals.com/content/${"a".repeat(64)}i0` },
        { asset: "https://example.mypinata.cloud/x.glb" },
      ],
      box: [{ s: { x: 1, y: 2, z: 3 }, col: "#FF0000" }],
      solidground: [{ s: { x: 450, y: 1, z: 450 } }],
    });
    expect(g.models).toHaveLength(1);
    expect(g.assets).toBe(2);
    expect(g.prims.map((p) => p.shape)).toEqual(["plane", "box"]);
    expect(g.prims[1].color).toBe("#ff0000");
  });

  it("vendors all 87 heights and nothing else", async () => {
    expect(await archiveGeometryFor(13321)).not.toBeNull();
    expect(await archiveGeometryFor(114588)).not.toBeNull();
    expect(await archiveGeometryFor(12345)).toBeNull();
    const pack = (await import("./vendor/inscribedspace-archive.json")).default as Record<string, unknown>;
    expect(Object.keys(pack)).toHaveLength(87);
  });
});
