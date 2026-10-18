import { describe, expect, it } from "vitest";
import { placeBubble } from "./toon-anchors";

describe("placeBubble", () => {
  it("sits centred above the head", () => {
    const r = placeBubble(500, 400, 200, 80, 1280, 720, 20, 10, []);
    expect(r).toEqual({ x: 400, y: 300, w: 200, h: 80 });
  });
  it("stays inside the frame near edges", () => {
    const r = placeBubble(1270, 30, 200, 80, 1280, 720, 20, 10, []);
    expect(r.x).toBe(1070);
    expect(r.y).toBe(10);
  });
  it("does not overlap an earlier bubble", () => {
    const a = placeBubble(500, 400, 200, 80, 1280, 720, 20, 10, []);
    const b = placeBubble(520, 400, 200, 80, 1280, 720, 20, 10, [a]);
    expect(b.y >= a.y + a.h || b.y + b.h <= a.y).toBe(true);
  });
});

describe("placeBubble around emotes", () => {
  it("never covers an emote icon sitting where the bubble would go", () => {
    const emote = { x: 450, y: 280, w: 60, h: 60 };
    const b = placeBubble(500, 400, 200, 80, 1280, 720, 20, 10, [emote]);
    const hit = b.x < emote.x + emote.w && b.x + b.w > emote.x && b.y < emote.y + emote.h && b.y + b.h > emote.y;
    expect(hit).toBe(false);
  });
});
