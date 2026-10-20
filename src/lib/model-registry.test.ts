import { describe, expect, it } from "vitest";
import { INSCRIPTION_ID_RE, REGISTRY_MODELS, isRegisteredModel } from "./model-registry";

describe("model registry", () => {
  it("lists only well-formed, unique inscription ids", () => {
    const ids = REGISTRY_MODELS.map((m) => m.inscription);
    for (const id of ids) expect(INSCRIPTION_ID_RE.test(id)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("refuses models that are not registered", () => {
    expect(isRegisteredModel("0".repeat(64) + "i0")).toBe(false);
    expect(isRegisteredModel(REGISTRY_MODELS[0]!.inscription)).toBe(true);
  });
});
