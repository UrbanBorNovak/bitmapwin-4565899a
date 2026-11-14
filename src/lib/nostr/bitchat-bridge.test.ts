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

import { sendStateFrom } from "./bitchat-bridge";
describe("bitchat send status", () => {
  it("one relay accepting counts as accepted", () => {
    expect(sendStateFrom({ accepted: ["wss://a"], rejected: [{ url: "wss://b", reason: "x" }], of: 2 }).kind).toBe("accepted");
  });
  it("no relay accepting is a failure with the relay's reason", () => {
    const s = sendStateFrom({ accepted: [], rejected: [{ url: "wss://b", reason: "pow: difficulty 8<12" }], of: 1 });
    expect(s).toMatchObject({ kind: "failed", reason: "pow: difficulty 8<12" });
  });
});

import { BITMAP_ROOM_RELAYS, bitmapRoomTags, isBitmapRoomEvent, roomHeight } from "./bitchat-bridge";
describe("BW-ROOMS-1", () => {
  it("labels a room with b = block height", () => {
    expect(bitmapRoomTags(840000, " Urban ")).toEqual([["b", "840000"], ["n", "Urban"]]);
  });
  it("only accepts kind 20000 with the exact height", () => {
    expect(isBitmapRoomEvent({ kind: 20000, tags: [["b", "840000"]] }, 840000)).toBe(true);
    expect(isBitmapRoomEvent({ kind: 20000, tags: [["b", "84000"]] }, 840000)).toBe(false);
    expect(isBitmapRoomEvent({ kind: 1, tags: [["b", "840000"]] }, 840000)).toBe(false);
  });
  it("ignores BitChat location messages that also carry b", () => {
    expect(isBitmapRoomEvent({ kind: 20000, tags: [["b", "840000"], ["g", "u2mw"]] }, 840000)).toBe(false);
  });
  it("uses the same five relays for every room", () => {
    expect(BITMAP_ROOM_RELAYS).toHaveLength(5);
    expect(new Set(BITMAP_ROOM_RELAYS).size).toBe(5);
  });
  it("accepts only whole non-negative heights", () => {
    expect(roomHeight("840000")).toBe(840000);
    expect(roomHeight(0)).toBe(0);
    expect(roomHeight("-1")).toBeNull();
    expect(roomHeight("1.5")).toBeNull();
  });
});
