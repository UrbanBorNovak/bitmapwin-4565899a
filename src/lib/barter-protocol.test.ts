import { describe, expect, it } from "vitest";
import { satpointProblem, buildSwapLayout, matchesCriteria, ticketProblem, verifyLayoutForMaker, type AssetFacts, type BarterTicket } from "./barter-protocol";

const h = (c: string) => c.repeat(64);
const ticket: BarterTicket = {
  makerAddress: "bc1pmaker",
  offeringOutpoint: `${h("a")}:0`,
  offeringInscription: `${h("a")}i0`,
  offeringValue: 10_000,
  sweetenerSats: 0,
  sweetenerDir: "demand",
  criteria: { assetType: "bitmap", maxHeight: 99_999 },
};
const maker: AssetFacts = { inscriptionId: `${h("a")}i0`, outpoint: `${h("a")}:0`, value: 10_000, offset: 0, type: "guardian", spent: false };
const taker: AssetFacts = { inscriptionId: `${h("b")}i0`, outpoint: `${h("b")}:1`, value: 546, offset: 0, type: "bitmap", height: 84_210, spent: false };
const base = { ticket, maker, taker, takerAddress: "bc1ptaker", takerChange: "bc1qchange", funding: [{ outpoint: `${h("c")}:0`, value: 20_000 }], feeSats: 2_000 };

describe("BW-BARTER-1", () => {
  it("sub-100k rule accepts 84,210 and refuses 100,000", () => {
    expect(matchesCriteria(ticket.criteria, taker)).toBe(true);
    expect(matchesCriteria(ticket.criteria, { ...taker, height: 100_000 })).toBe(false);
  });
  it("missing height never matches a height rule", () => {
    const { height: _h, ...noHeight } = taker;
    expect(matchesCriteria(ticket.criteria, noHeight)).toBe(false);
  });
  it("spent assets never match", () => {
    expect(matchesCriteria(ticket.criteria, { ...taker, spent: true })).toBe(false);
  });
  it("refuses tickets with no rules", () => {
    expect(ticketProblem({ ...ticket, criteria: {} })).toBe("criteria must name at least one rule");
  });
  it("keeps both postages exact and passes maker check", () => {
    const l = buildSwapLayout(base);
    if ("error" in l) throw new Error(l.error);
    expect(l.outputs[0]).toEqual({ address: "bc1ptaker", value: 10_000 });
    expect(l.outputs[1]).toEqual({ address: "bc1pmaker", value: 546 });
    expect(l.feeSats).toBe(2_000);
    expect(verifyLayoutForMaker(l, ticket, taker)).toBeNull();
  });
  it("demanded sweetener goes to maker", () => {
    const t = { ...ticket, sweetenerSats: 5_000 };
    const l = buildSwapLayout({ ...base, ticket: t });
    if ("error" in l) throw new Error(l.error);
    expect(l.outputs[2]).toEqual({ address: "bc1pmaker", value: 5_000 });
    expect(verifyLayoutForMaker({ ...l, outputs: l.outputs.filter((_, i) => i !== 2) }, t, taker)).toBe("sweetener missing");
  });
  it("refuses inscriptions not at offset 0", () => {
    expect(buildSwapLayout({ ...base, taker: { ...taker, offset: 300 } })).toEqual({ error: "inscription not at offset 0" });
  });
  it("satpoint: accepts first sat of its own single-inscription output", () => {
    expect(satpointProblem({ outpoint: `${h("b")}:1`, value: 546, satpoint: `${h("b")}:1:0`, inscriptionsInUtxo: 1 })).toBeNull();
  });
  it("satpoint: refuses offset 300, moved output, shared output, unreadable", () => {
    const o = `${h("b")}:1`;
    expect(satpointProblem({ outpoint: o, value: 10_000, satpoint: `${h("b")}:1:300`, inscriptionsInUtxo: 1 })).toBe("inscription sits at sat 300, not the first sat");
    expect(satpointProblem({ outpoint: o, value: 546, satpoint: `${h("c")}:0:0`, inscriptionsInUtxo: 1 })).toBe("inscription has moved to another output");
    expect(satpointProblem({ outpoint: o, value: 546, satpoint: `${h("b")}:1:0`, inscriptionsInUtxo: 2 })).toMatch(/holds 2 inscriptions/);
    expect(satpointProblem({ outpoint: o, value: 546, satpoint: null, inscriptionsInUtxo: 1 })).toBe("position could not be read from chain");
  });
  it("maker check catches a redirected asset", () => {
    const l = buildSwapLayout(base);
    if ("error" in l) throw new Error(l.error);
    const tampered = { ...l, outputs: [l.outputs[0]!, { address: "bc1pthief", value: 546 }, ...l.outputs.slice(2)] };
    expect(verifyLayoutForMaker(tampered, ticket, taker)).toBe("maker does not receive matched asset intact");
  });
});

import { offerProofMessage as _opm } from "./barter-protocol";
describe("offer proof message", () => {
  const t = { makerAddress: "bc1pmaker", offeringOutpoint: "a".repeat(64) + ":0", offeringInscription: "b".repeat(64) + "i0", offeringValue: 546, sweetenerSats: 0, sweetenerDir: "demand" as const, criteria: { maxHeight: 9, assetType: "bitmap" as const } };
  it("is identical regardless of criteria key order", () => {
    expect(_opm(t, "c".repeat(64), 1)).toBe(_opm({ ...t, criteria: { assetType: "bitmap", maxHeight: 9 } }, "c".repeat(64), 1));
  });
  it("changes when the nostr key changes", () => {
    expect(_opm(t, "c".repeat(64), 1)).not.toBe(_opm(t, "d".repeat(64), 1));
  });
});
