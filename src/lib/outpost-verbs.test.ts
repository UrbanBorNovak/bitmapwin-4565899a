import { describe, expect, it } from "vitest";
import { resolveOutpostVerb } from "./outpost-verbs";
import { QUESTS, applyEvent, blankProgress, missionStepFor } from "./biternam-quests";

describe("Bitoshi outpost", () => {
  it("refuses to talk without the hazmat suit", () => {
    expect(resolveOutpostVerb("talk", "bitoshi", { suited: false, item: null }).effect).toBeNull();
    expect(resolveOutpostVerb("talk", "bitoshi", { suited: true, item: null }).effect).toBe("talk");
  });
  it("opening the stove blasts you out", () => {
    expect(resolveOutpostVerb("open", "stove", { suited: true, item: null }).effect).toBe("blast");
  });
  it("using the suit near the cook puts it on", () => {
    expect(resolveOutpostVerb("use", "bitoshi", { suited: false, item: "suit" }).effect).toBe("wear-suit");
  });
  it("chapter 3 pays 50 BIT and ends by handing Wierdamoto the blue sample", () => {
    const q = QUESTS.find((x) => x.id === "ch3")!;
    expect(q.bit).toBe(50);
    expect(q.steps.at(-1)).toMatchObject({ kind: "give", target: "wierdamoto", item: "blue-sample" });
  });
  it("Bitoshi only hands over the sample after the hazmat suit step, and only indoors", () => {
    let p = blankProgress();
    p = applyEvent(p, "talk", "dev9").next;
    p = applyEvent(p, "visit", "miner-rig-4").next;
    expect(applyEvent(p, "talk", "bitoshi").advanced).toHaveLength(0);
    p = applyEvent(p, "pickup", "hazmat-suit").next;
    expect(missionStepFor("bitoshi", p)?.step.indoors).toBe("/biternam/outpost");
    expect(applyEvent(p, "talk", "bitoshi").advanced).toHaveLength(1);
  });
});
