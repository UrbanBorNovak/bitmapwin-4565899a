import { describe, expect, it } from "vitest";
import { JOKE_ARCS, shortLine } from "@/lib/biternam-banter";
import { chapterEpisode } from "@/lib/biternam-chapter";
describe("chapter jokes", () => {
  it("every joke beat is one sentence of at most five words", () => {
    for (const arc of JOKE_ARCS) for (const l of arc) { expect(l.split(/\s+/).length).toBeLessThanOrEqual(5); expect(l.match(/[.!?]/g)?.length).toBe(1); }
  });
  it("long user quotes are cut to five words", () => { expect(shortLine("one two three four five six. seven")).toBe("one two three four five."); });
  it("every episode line is at most five words", () => {
    const ep = chapterEpisode({ height: 840000, txCount: 3000 }, "T", "A very long quote that goes on and on");
    for (const s of ep.scenes) for (const l of s.lines) expect(l.text.split(/\s+/).length).toBeLessThanOrEqual(5);
  });
});
