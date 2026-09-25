import { describe, expect, it } from "vitest";
import { applyWorldEvent } from "./events";
import { newProfile } from "./persistence";

describe("living card learning", () => {
  it("learns its type adaptation after three plays exactly once", () => {
    let profile = newProfile("learner");
    const cardId = profile.order[0];
    expect(cardId).toBeDefined();
    if (!cardId) return;
    for (let i = 0; i < 3; i++) profile = applyWorldEvent(profile, { kind: "CARD_PLAYED", cardId, actor: "tester" }, i + 1).profile;
    const learned = profile.cards[cardId]?.learning.adaptations ?? [];
    expect(learned).toHaveLength(1);
    profile = applyWorldEvent(profile, { kind: "CARD_PLAYED", cardId, actor: "tester" }, 4).profile;
    expect(profile.cards[cardId]?.learning.adaptations).toEqual(learned);
  });

  it("learns battle tested after eight remembered actions", () => {
    let profile = newProfile("fighter");
    const cardId = profile.order[0];
    expect(cardId).toBeDefined();
    if (!cardId) return;
    for (let i = 0; i < 3; i++) profile = applyWorldEvent(profile, { kind: "CARD_PLAYED", cardId, actor: "tester" }, i + 1).profile;
    for (let i = 0; i < 5; i++) profile = applyWorldEvent(profile, { kind: "CARD_ATTACKED", cardId, actor: "tester" }, i + 4).profile;
    expect(profile.cards[cardId]?.learning.actions).toBe(8);
    expect(profile.cards[cardId]?.learning.adaptations).toContain("BATTLE_TESTED");
    expect(profile.cards[cardId]?.state).toBe("AWAKENED");
  });

  it("records exact growth snapshots after play and Oasis builds", () => {
    let profile = newProfile("historian");
    const cardId = profile.order[0];
    expect(cardId).toBeDefined();
    if (!cardId) return;
    profile = applyWorldEvent(profile, { kind: "CARD_PLAYED", cardId, actor: "tester" }, 10).profile;
    const played = profile.cards[cardId];
    expect(played?.history.at(-1)?.growth).toMatchObject({ state: "ACTIVE", plays: 1, activity: 1 });

    if (!played) return;
    const defenseBeforeBuild = played.defense;
    profile = applyWorldEvent(profile, { kind: "NEW_BUILD", height: played.bitmap, buildCount: 1 }, 20).profile;
    const built = profile.cards[cardId];
    expect(built?.history.at(-1)?.growth).toMatchObject({ defense: defenseBeforeBuild + 1, buildCount: 1 });
    expect(built?.history.at(-1)?.growth?.traits).toContain("BUILDER");
  });
});