import { describe, it, expect } from "vitest";
import { checkMintParents } from "./mint-parents-guard";
import { MASTER_PARENT_ID } from "./collection-parent";

const BM = "a".repeat(64) + "i0";
const ok = { parents: [{ inscriptionId: BM }, { inscriptionId: MASTER_PARENT_ID }], bitmapParentId: BM, masterInscriptionId: MASTER_PARENT_ID };

describe("voxel build mint parents fail closed", () => {
  it("passes only with both parents resolved and included", () => {
    expect(checkMintParents(ok)).toEqual({ ok: true });
  });
  it("stops when the BITMAP parent is missing", () => {
    const r = checkMintParents({ ...ok, bitmapParentId: null, parents: [{ inscriptionId: MASTER_PARENT_ID }] });
    expect(r.ok === false && r.missing).toEqual(["BITMAP"]);
  });
  it("stops when the collection parent is missing", () => {
    const r = checkMintParents({ ...ok, masterInscriptionId: null, parents: [{ inscriptionId: BM }] });
    expect(r.ok === false && r.missing).toEqual(["COLLECTION"]);
  });
  it("stops when both are missing and names both", () => {
    const r = checkMintParents({ parents: [], bitmapParentId: null, masterInscriptionId: null, notes: ["CHAIN DOWN"] });
    expect(r.ok === false && r.missing).toEqual(["BITMAP", "COLLECTION"]);
    expect(r.ok === false && r.message).toContain("CHAIN DOWN");
  });
  it("rejects a different collection id than the verified one", () => {
    const other = "b".repeat(64) + "i0";
    const r = checkMintParents({ ...ok, masterInscriptionId: other, parents: [{ inscriptionId: BM }, { inscriptionId: other }] });
    expect(r.ok === false && r.missing).toEqual(["COLLECTION"]);
  });
  it("rejects a resolved parent that was not actually included as a spend", () => {
    expect(checkMintParents({ ...ok, parents: [{ inscriptionId: MASTER_PARENT_ID }] }).ok).toBe(false);
    expect(checkMintParents({ ...ok, parents: [{ inscriptionId: BM }] }).ok).toBe(false);
  });
});
