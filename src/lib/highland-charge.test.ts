import { describe, expect, it } from "vitest";
import { CHARGE_CYCLE, THREATS, newBattleGame, stepBattle } from "./highland-charge";

describe("highland charge commander", () => {
  it("falls when a threat lands without a shield", () => {
    const g = newBattleGame();
    for (let t = 0; t <= THREATS[0]!.at + 0.05; t += 0.05) stepBattle(g, t, true);
    expect(g.last).toBe("HIT");
    expect(g.heroDownAt).not.toBeNull();
  });
  it("blocks every threat when the shield is raised just before each one and earns a streak", () => {
    const g = newBattleGame();
    for (let t = 0; t <= CHARGE_CYCLE + 0.1; t += 0.05) {
      if (THREATS.some((x) => Math.abs(x.at - 0.3 - t) < 0.026)) g.raise = true;
      stepBattle(g, t, true);
    }
    expect(g.blocks).toBe(3);
    expect(g.streak).toBe(1);
  });
});

import { CAV_CONTACT, BREAKOUT_AFTER } from "./highland-charge";
describe("King's rally", () => {
  const run = (vip: boolean) => {
    const g = newBattleGame(); g.vip = vip; g.standing = 400;
    for (let t = 0; t <= CAV_CONTACT + BREAKOUT_AFTER + 1; t += 0.05) {
      if (THREATS.some((x) => Math.abs(x.at - 0.3 - t) < 0.026)) g.raise = true;
      if (Math.abs(t - (CAV_CONTACT + 0.5)) < 0.026) g.mount = true;
      stepBattle(g, t, true);
    }
    return g;
  };
  it("a surviving VIP mounts and breaks out for glory", () => {
    const g = run(true);
    expect(g.breakouts).toBe(1);
    expect(g.glory).toBe(400);
  });
  it("non-VIP soldiers cannot mount", () => {
    const g = run(false);
    expect(g.rallyAt).toBeNull();
    expect(g.breakouts).toBe(0);
  });
});

import { kingEligible } from "./launch-seats";
describe("King eligibility", () => {
  it("only the server-verified VIP seat may ride", () => {
    expect(kingEligible({ seat: 7, vip: true }, 7)).toBe(true);
  });
  it("following someone else's seat grants nothing", () => {
    expect(kingEligible({ seat: 7, vip: true }, 8)).toBe(false);
  });
  it("no verification or a non-VIP seat grants nothing", () => {
    expect(kingEligible(null, 1)).toBe(false);
    expect(kingEligible({ seat: 300, vip: false }, 300)).toBe(false);
  });
});
