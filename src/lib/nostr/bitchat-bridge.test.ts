import { describe, it, expect } from "vitest";
import { getEventHash } from "nostr-tools/pure";
import { bitchatRelaysFor, closestRelays, decodeGeohashCenter, encodeGeohash, isGeohash, leadingZeroBits, mineNonce } from "./bitchat-bridge";

describe("bitchat bridge", () => {
  it("encodes a known point", () => expect(encodeGeohash(57.64911, 10.40744, 5)).toBe("u4pru"));
  it("decodes back to the cell centre", () => {
    const c = decodeGeohashCenter("u4pru");
    expect(encodeGeohash(c.lat, c.lon, 5)).toBe("u4pru");
  });
  it("validates", () => { expect(isGeohash("u2mw")).toBe(true); expect(isGeohash("a1")).toBe(false); });
  it("picks 5 nearest per app, ties by host", () => {
    const rows: [string, number, number][] = [["b.x", 0, 0], ["a.x", 0, 0], ["far.x", 50, 50], ["c.x", 0, 1], ["d.x", 0, 2], ["e.x", 0, 3]];
    expect(closestRelays(rows, "s0000")).toEqual(["wss://a.x", "wss://b.x", "wss://c.x", "wss://d.x", "wss://e.x"]);
  });
  it("uses between 5 and 10 relays for Ljubljana", () => {
    const r = bitchatRelaysFor("u2mw");
    expect(r.length).toBeGreaterThanOrEqual(5);
    expect(r.length).toBeLessThanOrEqual(10);
  });
  it("mines 12 bits of proof of work", async () => {
    const t = { pubkey: "a".repeat(64), created_at: 1, kind: 20000, tags: [["g", "u2mw"]], content: "hi" };
    const tags = await mineNonce(t, 12);
    expect(tags.at(-1)?.[0]).toBe("nonce");
    expect(leadingZeroBits(getEventHash({ ...t, tags }))).toBeGreaterThanOrEqual(12);
  });
});
