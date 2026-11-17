import { describe, expect, it } from "vitest";
import { answerableBounties, isInscriptionRef, type Bounty } from "./bounty-client";
import { explainResult, PILOT_ERRORS } from "./stacks-tx-outcome";

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

describe("explainResult", () => {
  it("explains the deadline refusal", () => {
    expect(explainResult("(err u105)")).toBe("The deadline has passed, so new builds can no longer be submitted.");
  });
  it("explains answering your own bounty", () => {
    expect(explainResult("(err u108)")).toBe("You cannot answer your own bounty. Use a different Stacks account.");
  });
  it("explains an empty wallet when posting", () => {
    expect(explainResult("(err u1)")).toBe("Not enough test sats in this wallet. Use the button to get test sats first.");
  });
  it("returns nothing for a successful call", () => {
    expect(explainResult("(ok true)", "success")).toBeNull();
  });
});

describe("explainResult for the attestation pilot", () => {
  it("uses the pilot's own meaning for its codes", () => {
    expect(explainResult("(err u403)", "abort_by_response", PILOT_ERRORS)).toBe("The pilot is paused right now.");
  });
});
