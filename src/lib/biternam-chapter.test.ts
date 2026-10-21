import { describe, expect, it } from "vitest";
import { chapterEpisode, chapterTheme, cleanText, TITLE_MAX } from "./biternam-chapter";

describe("biternam chapter generator", () => {
  it("themes come only from block facts", () => {
    expect(chapterTheme({ height: 0, txCount: 1 })).toBe("genesis");
    expect(chapterTheme({ height: 840000, txCount: 3050 })).toBe("halving");
    expect(chapterTheme({ height: 9, txCount: 1 })).toBe("patoshi");
    expect(chapterTheme({ height: 800000, txCount: null })).toBe("plain");
  });
  it("same inputs give the same episode", () => {
    const f = { height: 777777, txCount: 2000 };
    expect(JSON.stringify(chapterEpisode(f, "A", "B"))).toBe(JSON.stringify(chapterEpisode(f, "A", "B")));
    expect(chapterEpisode(f, "A", "B").scenes.every((s) => s.block === 777777)).toBe(true);
  });
  it("text is bounded", () => {
    expect(cleanText("x".repeat(200), TITLE_MAX)).toHaveLength(60);
  });
});
import { factsLine } from "./biternam-chapter";
describe("facts line", () => {
  it("only states known facts", () => {
    expect(factsLine({ height: 1, txCount: null })).toBe("The ledger for this block is still being read.");
    expect(factsLine({ height: 1, txCount: 5, avgFeeRate: null, minedAt: "2025-06-15T00:00:00Z" })).toBe("Mined 2025-06-15. 5 transactions. Every one is a clue.");
  });
});
