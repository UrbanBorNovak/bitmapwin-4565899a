import { describe, expect, it } from "vitest";
import { emptyDevotion, pilgrimage, pray, rankOf, streak } from "@/lib/church";

const d = (s: string) => new Date(s + "T12:00:00Z");

describe("Church of BITMAP rituals", () => {
  it("counts only one prayer per UTC day", () => {
    const v = pray(pray(emptyDevotion(), d("2026-10-18")), new Date("2026-10-18T23:59:00Z"));
    expect(v.days).toEqual(["2026-10-18"]);
  });
  it("streak survives until a full day is missed", () => {
    let v = emptyDevotion();
    for (const day of ["2026-10-15", "2026-10-16", "2026-10-17"]) v = pray(v, d(day));
    expect(streak(v, d("2026-10-18"))).toBe(3);
    expect(streak(v, d("2026-10-19"))).toBe(0);
  });
  it("ranks: 7 prayers make a Deacon; each pilgrimage is worth 3", () => {
    let v = emptyDevotion();
    for (let i = 10; i < 17; i++) v = pray(v, d(`2026-10-${i}`));
    expect(rankOf(v).name).toBe("DEACON OF THE BLOCK");
    expect(rankOf(pilgrimage(emptyDevotion(), 0)).name).toBe("ACOLYTE");
    expect(rankOf(emptyDevotion()).name).toBe("HEATHEN");
  });
});
