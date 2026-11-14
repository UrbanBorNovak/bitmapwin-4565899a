import { describe, it, expect } from "vitest";
import { encodeGeohash, isGeohash } from "./bitchat-bridge";
describe("bitchat geohash", () => {
  it("encodes a known point", () => expect(encodeGeohash(57.64911, 10.40744, 5)).toBe("u4pru"));
  it("validates", () => { expect(isGeohash("u2mw")).toBe(true); expect(isGeohash("a1")).toBe(false); });
});
