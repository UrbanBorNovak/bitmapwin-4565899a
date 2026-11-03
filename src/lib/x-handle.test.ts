import { describe, expect, it } from "vitest";
import { isValidXHandle, normalizeXHandle } from "./x-handle";

describe("x handle", () => {
  it("strips @ and profile URLs", () => {
    expect(normalizeXHandle("@bitmapwin")).toBe("bitmapwin");
    expect(normalizeXHandle("https://x.com/bitmapwin?s=1")).toBe("bitmapwin");
    expect(normalizeXHandle("https://twitter.com/bitmap_win/status/1")).toBe("bitmap_win");
    expect(normalizeXHandle("  ")).toBeNull();
  });
  it("rejects handles over 15 chars or with bad characters", () => {
    expect(isValidXHandle("a".repeat(16))).toBe(false);
    expect(isValidXHandle("bad-handle")).toBe(false);
    expect(isValidXHandle("good_handle1")).toBe(true);
  });
});

import { parseTweetUrl, tweetProves, xProofToken } from "./x-handle";
describe("tweet proof", () => {
  it("parses status links", () => {
    expect(parseTweetUrl("https://x.com/jack/status/20?s=1")).toEqual({ handle: "jack", id: "20000".slice(0, 0) + "20" } as never);
  });
  it("token is 8 hex chars and stable", async () => {
    const t = await xProofToken("bc1pABC");
    expect(t).toMatch(/^[0-9a-f]{8}$/);
    expect(await xProofToken("BC1PABC")).toBe(t);
  });
  it("requires both address and token in the tweet", () => {
    const html = "<p>Verifying my Bitcoin address bc1pabc on @bitmapwin<br>Proof: deadbeef</p>";
    expect(tweetProves(html, "bc1pABC", "deadbeef")).toBe(true);
    expect(tweetProves(html, "bc1pXYZ", "deadbeef")).toBe(false);
    expect(tweetProves(html, "bc1pABC", "00000000")).toBe(false);
  });
});
