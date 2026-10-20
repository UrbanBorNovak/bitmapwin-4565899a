import { describe, expect, it } from "vitest";
import { QUESTS, QUEST_NPCS, applyEvent, blankProgress, isComplete } from "./biternam-quests";
import { validateScript } from "./tracy-com";

describe("biternam quests", () => {
  it("steps only advance in order", () => {
    const p = applyEvent(blankProgress(), "talk", "wierdamoto").next;
    expect(p.step['q1'] ?? 0).toBe(0);
  });
  it("The First Halving Lockout completes after four talks and pays 30 BIT", () => {
    let p = blankProgress();
    for (const t of ["droid", "curator", "wierdamoto", "droid"]) p = applyEvent(p, "talk", t).next;
    const q1 = QUESTS.find((q) => q.id === "q1")!;
    expect(isComplete(q1, p)).toBe(true);
    expect(q1.bit).toBe(30);
  });
  it("every character's dialogue is a valid script", () => {
    for (const n of QUEST_NPCS) expect(validateScript(n.script)).toEqual([]);
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("crew quest", () => {
  i2("all five crew members stand in the Oasis and the crew quest pays 50 BIT", () => {
    for (const id of ["dev9", "tornado", "bop", "nine", "urban", "dabber", "bitlodo", "mononaut", "sunset", "wierdamoto"]) e2(QUEST_NPCS.some((n) => n.id === id)).toBe(true);
    e2(QUESTS.find((q) => q.id === "q3")!.bit).toBe(50);
  });
});

import { heldItems } from "./biternam-quests";
d2("chapter 1 mission", () => {
  i2("picking up items in order fills the wrist inventory and the mission pays 40 BIT", () => {
    let p = blankProgress();
    p = applyEvent(p, "pickup", "dust-sample").next; // out of order: ignored
    e2(heldItems(p)).toHaveLength(0);
    for (const [k, t] of [["pickup", "skiff-key"], ["talk", "curator"], ["pickup", "dust-sample"], ["pickup", "explorer-lens"], ["visit", "torii"]] as const) p = applyEvent(p, k, t).next;
    const ch1 = QUESTS.find((q) => q.id === "ch1")!;
    e2(isComplete(ch1, p)).toBe(true);
    e2(heldItems(p).map((i) => i.id)).toEqual(["skiff-key", "dust-sample", "explorer-lens"]);
    e2(ch1.bit).toBe(40);
  });
});

describe("architect easter egg", () => {
  it("pays a fixed 77 BIT after talking to Urban then finding the blueprint", async () => {
    const q = QUESTS.find((x) => x.id === "egg-architect")!;
    expect(q.bit).toBe(77);
    let p = applyEvent(blankProgress(), "talk", "urban").next;
    p = applyEvent(p, "pickup", "architect-blueprint").next;
    expect(isComplete(q, p)).toBe(true);
  });
});
