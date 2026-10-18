import { describe, it, expect } from "vitest";
import { activeCut, transitionAt, type ToonEpisode, type ToonScene } from "./toon-script";

const sc = (p: Partial<ToonScene>): ToonScene => ({ block: 1, duration: 5, shot: "wide", cast: [], lines: [], ...p });
describe("camera cuts", () => {
  it("uses a line's camera only while it is shown", () => {
    const s = sc({ lines: [{ at: 1, dur: 2, speaker: 0, text: "hi", style: "speech", cam: "close" }] });
    expect(activeCut(s, 0.5)).toBeNull();
    expect(activeCut(s, 2)?.cam).toBe("close");
    expect(activeCut(s, 3.1)).toBeNull();
  });
});
describe("transitions", () => {
  const ep: ToonEpisode = { title: "t", aspect: "16:9", scenes: [sc({}), sc({ transition: "fade" })] };
  it("fully covers the frame at the scene boundary and clears 0.45s away", () => {
    expect(transitionAt(ep, 5)?.k).toBeCloseTo(1);
    expect(transitionAt(ep, 4.4)).toBeNull();
    expect(transitionAt(ep, 5.5)).toBeNull();
  });
  it("hard cut draws nothing", () => {
    expect(transitionAt({ ...ep, scenes: [sc({}), sc({})] }, 5)).toBeNull();
  });
});
