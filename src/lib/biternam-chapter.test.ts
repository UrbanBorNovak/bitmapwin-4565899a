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
import { autoSet } from "./biternam-chapter";
describe("cast only what exists", () => {
  const f = { height: 800000, txCount: 2000 };
  it("no Guardian means no Guardian actor", () => {
    const ep = chapterEpisode(f, "A", "B", { guardian: null, hasBuild: false });
    expect(ep.scenes.every((s) => s.cast.every((a) => !!a.avatar))).toBe(true);
  });
  it("an awakened Guardian is cast from its block", () => {
    const ep = chapterEpisode(f, "A", "B", { guardian: { species: "VOID PHANTOM" }, hasBuild: true });
    expect(ep.scenes[0]!.cast[0]!.avatar).toBeUndefined();
    expect(ep.scenes[0]!.cast[0]!.height).toBe(800000);
  });
  it("Biternam sets follow the block or the holder's pick", () => {
    expect(autoSet({ height: 0, txCount: 1 })).toBe("vault");
    expect(autoSet({ height: 9, txCount: 1 })).toBe("batcave");
    expect(autoSet({ height: 800000, txCount: 3500 })).toBe("chinatown");
    expect(chapterEpisode(f, "A", "B", { guardian: null, hasBuild: false, set: "batcave" }).scenes[1]!.set).toBe("batcave");
  });
});
import { pickCoStars } from "./biternam-cast";
describe("random cast and cameras", () => {
  const f = { height: 800000, txCount: 2000 };
  it("co-stars are two different Unreasonables wearing BITMAP Pixels", () => {
    for (let s = 0; s < 30; s++) { const [a, b] = pickCoStars(800000, s); expect(a.id).not.toBe(b.id); expect(a.avatar.skin.startsWith("px:")).toBe(true); }
  });
  it("rolling changes cast or cameras; Guardian stays lead when awake", () => {
    const eps = [0, 1, 2, 3].map((seed) => JSON.stringify(chapterEpisode(f, "A", "B", { guardian: { species: "X" }, hasBuild: false, seed })));
    expect(new Set(eps).size).toBeGreaterThan(1);
    expect(chapterEpisode(f, "A", "B", { guardian: { species: "X" }, hasBuild: false, seed: 5 }).scenes[0]!.cast[0]!.avatar).toBeUndefined();
  });
});
