import { describe, expect, it } from "vitest";
import { JOKE_ARCS, JOKE_ARCS_ZH, jokeArc, shortLine } from "@/lib/biternam-banter";
import { chapterEpisode } from "@/lib/biternam-chapter";
describe("chapter jokes", () => {
  it("every joke beat is one sentence of at most five words", () => {
    for (const arc of JOKE_ARCS) for (const l of arc) { expect(l.split(/\s+/).length).toBeLessThanOrEqual(5); expect(l.match(/[.!?]/g)?.length).toBe(1); }
  });
  it("long quotes are rewritten into a complete sentence of five words or fewer", () => {
    expect(shortLine("I really just wanted to find the very best block in the whole chain.")).toBe("I wanted to find best.");
    expect(shortLine("The miner was actually so tired of all the fees!")).toBe("Miner was tired of fees!");
    expect(shortLine("Short and sweet.")).toBe("Short and sweet.");
    for (const q of ["A very long quote that goes on and on", "We came to the cafe for coffee and stayed for the blocks"]) {
      const r = shortLine(q); expect(r.split(/\s+/).length).toBeLessThanOrEqual(5); expect(r).toMatch(/^[A-Z].*[a-z][.!?]$/);
    }
  });
  it("every episode line is at most five words", () => {
    const ep = chapterEpisode({ height: 840000, txCount: 3000 }, "T", "A very long quote that goes on and on");
    for (const s of ep.scenes) for (const l of s.lines) expect(l.text.split(/\s+/).length).toBeLessThanOrEqual(5);
  });
  it("Chinese jokes mirror every English arc beat for beat", () => {
    expect(JOKE_ARCS_ZH.length).toBe(JOKE_ARCS.length);
    for (const a of JOKE_ARCS_ZH) expect(a.length).toBe(6);
    for (const h of [0, 715093, 840000]) expect(JOKE_ARCS.indexOf(jokeArc(h, 3))).toBe(JOKE_ARCS_ZH.indexOf(jokeArc(h, 3, "zh")));
    const ep = chapterEpisode({ height: 715093, txCount: 3000 }, "T", "Q", { guardian: null, hasBuild: false, lang: "zh" });
    expect(ep.scenes.flatMap((s) => s.lines).some((l) => JOKE_ARCS_ZH.flat().includes(l.text))).toBe(true);
  });
});
