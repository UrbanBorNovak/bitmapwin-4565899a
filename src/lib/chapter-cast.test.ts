import { describe, expect, it } from "vitest";
import { fromQuery, lookup, statusLabel } from "./chapter-cast";
import { chapterEpisode } from "./biternam-chapter";

const ok = <R,>(data: R | null) => () => Promise.resolve({ data, error: null });
const fail = () => Promise.resolve({ data: null, error: { message: "boom" } });
const f = { height: 800000, txCount: 2000 };

describe("chapter cast lookups (mocked)", () => {
  it("no Guardian row is a confirmed absence", async () => {
    expect(await lookup(ok(null), (r: { species: string }) => r.species)).toEqual({ state: "absent" });
  });
  it("a failed lookup is unavailable, never absent", async () => {
    expect(await lookup(fail, (r: { species: string }) => r.species)).toEqual({ state: "unavailable" });
    expect(await lookup(() => Promise.reject(new Error("net")), (r: { x: string }) => r.x)).toEqual({ state: "unavailable" });
  });
  it("a row with a missing asset field is unavailable, not found", async () => {
    expect(await lookup(ok({ inscription_id: "" }), (r) => r.inscription_id || null)).toEqual({ state: "unavailable" });
  });
  it("labels distinguish absent from unavailable", () => {
    expect(statusLabel({ state: "absent" }, "F", "NONE")).toBe("NONE");
    expect(statusLabel({ state: "unavailable" }, "F", "NONE")).toBe("UNAVAILABLE · LOOKUP FAILED");
  });
  it("data from the previous block is never used after switching", () => {
    const prev = { state: "found" as const, value: "VOID PHANTOM" };
    expect(fromQuery({ isPending: false, isError: false, data: prev }, 800000, 208)).toEqual({ state: "checking" });
    expect(fromQuery({ isPending: false, isError: true, data: prev }, 800000, 800000)).toEqual({ state: "unavailable" });
  });
  it("no Guardian and no build: only avatars on stage, no build cue", () => {
    const ep = chapterEpisode(f, "A", "B", { guardian: null, hasBuild: false });
    expect(ep.scenes.every((s) => s.cast.every((a) => !!a.avatar))).toBe(true);
    expect(ep.scenes[0]!.sfx).not.toBe("BUILT!");
  });
  it("failed Guardian lookup draws no Guardian and does not claim one is absent", () => {
    const ep = chapterEpisode(f, "A", "B", { guardian: null, hasBuild: false, guardianUnknown: true });
    expect(ep.scenes.every((s) => s.cast.every((a) => !!a.avatar))).toBe(true);
    const text = ep.scenes.flatMap((s) => s.lines.map((l) => l.text)).join(" ");
    // The chapter script never states Guardian status, so a failed lookup must not leak an absence claim.
    expect(text).not.toMatch(/No Guardian|Nobody's guarding/);
    expect(ep.scenes.every((s) => s.cast.every((a) => !a.name.startsWith(`${f.height}.bitmap · `)))).toBe(true);
  });
});
