import { describe, expect, it } from "vitest";
import { answerableBounties, isInscriptionRef, type Bounty } from "./bounty-client";

const b = (id: number, o: Partial<Bounty> = {}): Bounty => ({ id, poster: "STPOSTER", height: 100, amount: 1000, title: "t", deadline: 50, created: 1, status: "open", winner: null, submissions: [], ...o });

describe("answerableBounties", () => {
  it("hides paid, refunded and expired bounties", () => {
    const list = [b(1), b(2, { status: "paid" }), b(3, { status: "refunded" }), b(4, { deadline: 49 })];
    expect(answerableBounties(list, 50, null).map((x) => x.id)).toEqual([1]);
  });
  it("hides the builder's own bounties", () => {
    expect(answerableBounties([b(1), b(2, { poster: "STME" })], 10, null, "STME").map((x) => x.id)).toEqual([1]);
  });
  it("puts the open BITMAP first, then the biggest reward", () => {
    const list = [b(1, { amount: 5000 }), b(2, { height: 521066, amount: 2000 }), b(3, { amount: 9000 })];
    expect(answerableBounties(list, 10, 521066).map((x) => x.id)).toEqual([2, 3, 1]);
  });
});

describe("isInscriptionRef", () => {
  it("accepts txid + i + index only", () => {
    expect(isInscriptionRef(`${"a".repeat(64)}i0`)).toBe(true);
    expect(isInscriptionRef("abci0")).toBe(false);
    expect(isInscriptionRef(`${"A".repeat(64)}i0`)).toBe(false);
  });
});
