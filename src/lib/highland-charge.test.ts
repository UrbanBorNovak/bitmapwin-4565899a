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
  const run = (vip: boolean, spear = true) => {
    const g = newBattleGame(); g.vip = vip; g.standing = 400;
    for (let t = 0; t <= CAV_CONTACT + BREAKOUT_AFTER + 1; t += 0.05) {
      if (THREATS.some((x) => x.kind === "arrows" && Math.abs(x.at - 0.3 - t) < 0.026)) g.raise = true;
      if (Math.abs(CAV_CONTACT - 0.2 - t) < 0.026) { if (spear) g.thrust = true; else g.raise = true; }
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
  it("non-VIP soldiers spear the rider but cannot take the horse", () => {
    const g = run(false);
    expect(g.rider).toBe("speared");
    expect(g.kills).toBe(1);
    expect(g.rallyAt).toBeNull();
    expect(g.breakouts).toBe(0);
  });
  it("a shield stops the rider but leaves no horse to take, even for a VIP", () => {
    const g = run(true, false);
    expect(g.rider).toBe("stopped");
    expect(g.heroDownAt).toBeNull();
    expect(g.rallyAt).toBeNull();
  });
  it("a spear does not stop arrows", () => {
    const g = newBattleGame();
    for (let t = 0; t <= THREATS[0]!.at + 0.05; t += 0.05) { if (Math.abs(THREATS[0]!.at - 0.2 - t) < 0.026) g.thrust = true; stepBattle(g, t, true); }
    expect(g.last).toBe("HIT");
  });
  it("an unblocked rider gallops through", () => {
    const g = newBattleGame();
    for (let t = 0; t <= CAV_CONTACT + 0.1; t += 0.05) { if (THREATS.some((x) => x.kind === "arrows" && Math.abs(x.at - 0.3 - t) < 0.026)) g.raise = true; stepBattle(g, t, true); }
    expect(g.rider).toBe("through");
    expect(g.last).toBe("HIT");
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

describe("frame-rate independent timing", () => {
  it("a shield raised just before contact still blocks when the next frame lands well after it", () => {
    const g = newBattleGame();
    stepBattle(g, 11.5, true); g.heroDownAt = null; // skip the arrows
    stepBattle(g, CAV_CONTACT - 0.3, true); g.raise = true;
    stepBattle(g, CAV_CONTACT - 0.25, true);
    stepBattle(g, CAV_CONTACT + 0.6, true); // one slow frame jumps past the shield window
    expect(g.rider).toBe("stopped");
    expect(g.heroDownAt).toBeNull();
  });
});
