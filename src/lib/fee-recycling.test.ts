import { describe, it, expect } from "vitest";
import { splitFee } from "./fee-recycling";
describe("splitFee", () => {
  it("splits a 2,100 sat skin 50/30/20", () => expect(splitFee(2100)).toEqual({ pool: 1050, reserve: 630, runway: 420 }));
  it("gives rounding remainder to the pool", () => expect(splitFee(1)).toEqual({ pool: 1, reserve: 0, runway: 0 }));
});

import { recycleNote as _rn } from "./fee-recycling";
import { test as _t, expect as _e } from "vitest";
_t("checkout note for 2,100 sat skin names 1,050 to stakers and says not active", () => {
  _e(_rn(2100)).toContain("1,050 sats to BITMAP stakers");
  _e(_rn(2100)).toContain("not active yet");
});
