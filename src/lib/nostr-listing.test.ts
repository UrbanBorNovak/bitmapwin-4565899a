import { describe, expect, it } from "vitest";
import { listingTags, signEvent, verifyEvent } from "@/lib/nostr-listing";
import { buildSovereignStoreHtml } from "@/lib/sovereign-store";
import { DEFAULT_STORE } from "@/lib/store-template";

const SK = "1".repeat(64);
const tags = listingTags({ height: 800534, inscriptionId: "a".repeat(64) + "i0", outpoint: "b".repeat(64) + ":1", priceSats: 450000, psbtBase64: "cHNidP8=", seller: "bc1pseller" });

describe("nostr listing", () => {
  it("signs a verifiable kind 30402 event", () => {
    const e = signEvent(tags, "x", SK, 1_700_000_000);
    expect(e.kind).toBe(30402);
    expect(verifyEvent(e)).toBe(true);
  });
  it("rejects a tampered price", () => {
    const e = signEvent(tags, "x", SK, 1_700_000_000);
    const bad = { ...e, tags: e.tags.map((t) => (t[0] === "price" ? ["price", "1", "SAT"] : t)) };
    expect(verifyEvent(bad)).toBe(false);
  });
  it("sovereign shop never calls bitmapwin", () => {
    expect(buildSovereignStoreHtml(DEFAULT_STORE)).not.toContain("bitmapwin.app");
  });
});
