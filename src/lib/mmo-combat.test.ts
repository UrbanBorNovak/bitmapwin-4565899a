import { describe, expect, it } from "vitest";
import { rollSwing, regen, BASE_DAMAGE, SIT_REGEN_MULT } from "./mmo-combat";

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length] ?? 0; };
const v = { level: 1, cp: 0, maxCp: 120, hp: 100, maxHp: 240, mp: 0, maxMp: 90 };

describe("mmo combat", () => {
  it("misses below the miss chance", () => expect(rollSwing(seq(0.01), true, 90).kind).toBe("miss"));
  it("normal hit is base damage at mid spread", () => expect(rollSwing(seq(0.5, 0.5, 0.9), false, 0)).toEqual({ kind: "hit", damage: BASE_DAMAGE, usedShot: false }));
  it("crit multiplies damage", () => expect(rollSwing(seq(0.5, 0.5, 0.01), false, 0).damage).toBe(31));
  it("soulshot needs mana", () => expect(rollSwing(seq(0.5, 0.5, 0.9), true, 0).usedShot).toBe(false));
  it("sitting regenerates faster", () => expect(regen(v, 1, true).hp - 100).toBe(SIT_REGEN_MULT));
  it("regen caps at max", () => expect(regen({ ...v, hp: 240 }, 10, false).hp).toBe(240));
});
