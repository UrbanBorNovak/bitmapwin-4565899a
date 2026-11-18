import { describe, expect, it } from "vitest";
import { categoryFor, envelopeHelp, summarize, decodeEnvelope, readPackage, swapTargetFor, UE2_TAG, ver121Key } from "./ue2-package";

function buildPkg(): Uint8Array {
  const b: number[] = [];
  const u32 = (v: number) => b.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255);
  const u16 = (v: number) => b.push(v & 255, (v >> 8) & 255);
  u32(UE2_TAG); u16(123); u16(0); u32(0);
  const hdrSlots = b.length; for (let i = 0; i < 6; i++) u32(0);
  const set = (slot: number, v: number) => { const p = hdrSlots + slot * 4; b[p] = v & 255; b[p + 1] = (v >> 8) & 255; b[p + 2] = (v >> 16) & 255; b[p + 3] = (v >>> 24) & 255; };
  const names = ["None", "Core", "Engine", "StaticMesh", "Rock01"];
  set(0, names.length); set(1, b.length);
  for (const n of names) { b.push(n.length + 1, ...[...n].map((c) => c.charCodeAt(0)), 0); u32(0); }
  set(4, 1); set(5, b.length);
  b.push(2, 3); u32(0); b.push(3); // import Engine.StaticMesh
  set(2, 1); set(3, b.length);
  b.push(0x81, 0); u32(0); b.push(4); u32(0); b.push(10, 20); // export Rock01, class import #1
  return new Uint8Array(b);
}

describe("UE2 package reader", () => {
  it("reads names, imports and resolves export classes", () => {
    const p = readPackage(buildPkg(), "rocks.usx");
    expect(p.version).toBe(123);
    expect(p.exports[0]!).toMatchObject({ name: "Rock01", className: "StaticMesh", size: 10, offset: 20 });
  });
  it("decodes the Lineage2Ver111 XOR envelope", () => {
    const plain = buildPkg();
    const hdr = [..."Lineage2Ver111"].flatMap((c) => [c.charCodeAt(0), 0]);
    const enc = new Uint8Array([...hdr, ...plain.map((x) => x ^ 0xac)]);
    expect(decodeEnvelope(enc, "x.usx").kind).toBe("ver111");
    expect(readPackage(enc, "x.usx").exports[0]!.name).toBe("Rock01");
  });
  it("rejects RSA envelopes and derives ver121 keys from the name", () => {
    const hdr = new Uint8Array([..."Lineage2Ver413"].flatMap((c) => [c.charCodeAt(0), 0]));
    expect(decodeEnvelope(hdr, "a").kind).toBe("unsupported");
    expect(ver121Key("AB")).toBe((97 + 98) & 255);
  });
  it("swaps skeletal actors for Guardians and static meshes for slabs", () => {
    expect(swapTargetFor("SkeletalMesh")).toBe("guardian");
    expect(swapTargetFor("StaticMesh")).toBe("slab");
    expect(swapTargetFor("Texture")).toBe("keep");
  });
  it("swaps skeletal meshes, keeps animations as listed-only", () => {
    expect(swapTargetFor("MeshAnimation")).toBe("keep");
    expect(categoryFor("Shader")).toBe("texture");
    expect(categoryFor("IntProperty")).toBe("code");
  });
  it("explains Ver41x and truncated files", () => {
    expect(envelopeHelp("Lineage2Ver413")).toMatch(/RSA/);
    expect(() => readPackage(buildPkg().subarray(0, 40), "a.usx")).toThrow(/past end|unexpected end/);
  });
  it("counts categories", () => {
    expect(summarize(readPackage(buildPkg(), "r.usx")).prop).toBe(1);
  });
});
