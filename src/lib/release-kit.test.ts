import { describe, expect, it } from "vitest";
import { chapters, cleanHandle, channelUrl, releaseDescription, releaseTitle, youtubeChaptersValid } from "./release-kit";
import { PIXELS_HOMECOMING } from "./toon-teaser";

const none = { youtube: "", tiktok: "", x: "" };

describe("release kit", () => {
  it("timestamps start at 00:00 and add scene durations", () => {
    expect(chapters(PIXELS_HOMECOMING).slice(0, 3)).toEqual(["00:00 Scene 1 · 881133.BITMAP", "00:06 Scene 2 · 881133.BITMAP", "00:12 Scene 3 · 715093.BITMAP"]);
  });
  it("short scenes are not labelled as YouTube chapters", () => {
    expect(youtubeChaptersValid(PIXELS_HOMECOMING)).toBe(false);
    expect(releaseDescription(PIXELS_HOMECOMING, "youtube", none)).toContain("\nSCENES\n");
  });
  it("X caption fits 280 characters", () => {
    expect(releaseDescription(PIXELS_HOMECOMING, "x", none).length).toBeLessThanOrEqual(280);
  });
  it("Shorts title carries #Shorts within 100 chars", () => {
    const t = releaseTitle(PIXELS_HOMECOMING, "shorts");
    expect(t.endsWith("#Shorts")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(100);
  });
  it("handles normalise from URLs and reject junk", () => {
    expect(cleanHandle("https://www.tiktok.com/@bitmapper/video/1")).toBe("@bitmapper");
    expect(cleanHandle("javascript:alert(1)")).toBe("");
    expect(channelUrl("x", "@sat")).toBe("https://x.com/sat");
  });
});
