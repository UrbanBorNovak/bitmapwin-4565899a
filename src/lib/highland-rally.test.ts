import { describe, it, expect } from "vitest";
import { CAV_CONTACT, CHARGE_CYCLE, FIELD_GAP, KING_SPEED, KING_STOP, chargeOffset, kingZ, rallyGain } from "./highland-charge";

describe("King's ride", () => {
  const startZ = -FIELD_GAP / 2, speed = 4.2, rallyAt = CAV_CONTACT + 0.5;
  const zAt = (local: number) => kingZ(startZ + chargeOffset(local, speed), rallyGain(local, rallyAt, KING_SPEED));
  it("never passes the enemy wall stop and never jumps between frames", () => {
    let prev = zAt(rallyAt);
    for (let l = rallyAt; l < CHARGE_CYCLE; l += 1 / 60) {
      const z = zAt(l);
      expect(z).toBeLessThanOrEqual(KING_STOP);
      expect(Math.abs(z - prev)).toBeLessThan(KING_SPEED / 60 + 0.01);
      prev = z;
    }
    expect(zAt(CHARGE_CYCLE - 0.01)).toBeGreaterThan(FIELD_GAP / 2); // reaches through the wall
  });
});
