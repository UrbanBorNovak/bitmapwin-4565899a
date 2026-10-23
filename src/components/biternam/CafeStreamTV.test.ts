import { describe, expect, it } from "vitest";
import { breakSlides, tvState, withSponsors } from "./CafeStreamTV";

describe("café TV schedule", () => {
  it("plays 60s of stream, then four 4-second slides, then the stream again", () => {
    expect(tvState(59).slide).toBeNull();
    expect([60, 63, 64, 68, 72, 75].map((t) => tvState(t).slide)).toEqual([0, 0, 1, 2, 3, 3]);
    expect(tvState(76)).toMatchObject({ n: 1, slide: null });
    expect(tvState(60).left).toBe(16);
  });
  it("a live sponsor takes the closing slot and rotates each break", () => {
    const sp = [{ id: "a", slot: "cafe", title: "A", handle: "", kind: "image", media: "https://x/a.png", startsAt: "", endsAt: "" },
      { id: "b", slot: "cafe", title: "B", handle: "@b", kind: "inscription", media: "f".repeat(64) + "i0", startsAt: "", endsAt: "" }] as never;
    expect(withSponsors(breakSlides(0), sp, 0)[3]).toMatchObject({ image: "https://x/a.png", tag: "SPONSORED · A" });
    expect(withSponsors(breakSlides(1), sp, 1)[3]).toMatchObject({ id: "f".repeat(64) + "i0", tag: "SPONSORED · B · @b" });
    expect(withSponsors(breakSlides(0), [], 0)).toEqual(breakSlides(0));
  });
});
