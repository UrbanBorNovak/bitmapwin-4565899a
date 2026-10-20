import { describe, expect, it } from "vitest";
import { validateBuildProposal } from "./agent-build-schema";
import { parcelRects } from "./forge-parcels";
import { REGISTRY_MODELS } from "./model-registry";

const rects = parcelRects([1, 8]);
const k = "stone";

describe("agent build proposals", () => {
  it("refuses wallets that hold neither the BITMAP nor a parcel", () => {
    expect(validateBuildProposal({ blocks: [[1, 0, 1, k]] }, { role: "none", parcels: [] }, rects).ok).toBe(false);
  });

  it("clips a parcel holder's blocks to the cells that parcel owns", () => {
    const r = rects[0]!;
    const own = [...r.cells][0]!;
    const [x, z] = [Math.floor(own / 64), own % 64];
    const foreign = [...rects[1]!.cells][0]!;
    const v = validateBuildProposal({ parcelIndex: 0, blocks: [[x, 0, z, k], [Math.floor(foreign / 64), 0, foreign % 64, k]] }, { role: "parcel", parcels: [0] }, rects);
    expect(v.blocks).toHaveLength(1);
    expect(v.dropped.notYourGround).toBe(1);
  });

  it("refuses a parcel the wallet does not hold", () => {
    expect(validateBuildProposal({ parcelIndex: 1, blocks: [[0, 0, 0, k]] }, { role: "parcel", parcels: [0] }, rects).ok).toBe(false);
  });

  it("drops out-of-canvas and unknown blocks", () => {
    const v = validateBuildProposal({ blocks: [[64, 0, 0, k], [0, 0, 0, "lava-xyz"], [2, 0, 2, k]] }, { role: "bitmap", parcels: [] }, null);
    expect(v.dropped.outOfBounds).toBe(1);
    expect(v.dropped.unknownKind).toBe(1);
    expect(v.blocks).toHaveLength(1);
  });

  it("only lets the BITMAP holder place registered models", () => {
    const id = REGISTRY_MODELS[0]!.inscription;
    expect(validateBuildProposal({ blocks: [], modelInscriptionId: id }, { role: "bitmap", parcels: [] }, null).ok).toBe(true);
    expect(validateBuildProposal({ blocks: [], modelInscriptionId: "abc" }, { role: "bitmap", parcels: [] }, null).ok).toBe(false);
    expect(validateBuildProposal({ parcelIndex: 0, blocks: [], modelInscriptionId: id }, { role: "parcel", parcels: [0] }, rects).ok).toBe(false);
  });
});
