import { describe, expect, it } from "vitest";
import { parseTicketEvent } from "./barter-feed";
import { ticketTags, BARTER_KIND } from "./barter-protocol";

const h = (c: string) => c.repeat(64);
const ev = (tags: string[][]) => ({ id: "x", pubkey: "p", created_at: 1, kind: BARTER_KIND, tags, content: "hi", sig: "s" });
const good = ticketTags({
  makerAddress: "bc1pmaker", offeringOutpoint: `${h("a")}:0`, offeringInscription: `${h("a")}i0`,
  offeringValue: 10_000, sweetenerSats: 0, sweetenerDir: "demand", criteria: { assetType: "bitmap", maxHeight: 99_999 },
});

describe("barter feed", () => {
  it("reads a valid sub-100k ticket", () => {
    expect(parseTicketEvent(ev(good))?.criteria).toEqual({ assetType: "bitmap", maxHeight: 99_999 });
  });
  it("drops a ticket with no criteria", () => {
    expect(parseTicketEvent(ev(good.map((t) => (t[0] === "criteria_rules" ? ["criteria_rules", "{}"] : t))))).toBeNull();
  });
});
