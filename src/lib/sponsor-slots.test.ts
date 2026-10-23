import { describe, expect, it } from "vitest";
import { SPONSOR_SLOTS, TICKET_SATS, parseSponsorMedia, slotLive, sponsorPaymentOk, ticketRevealOk } from "./sponsor-slots";

const T = "bc1qtreasury";
const P = "bc1qpayer";

describe("sponsor slots", () => {
  it("prices: café 10,000 · jumbotron 25,000 · all screens 35,000 sats", () => {
    expect([SPONSOR_SLOTS.cafe.sats, SPONSOR_SLOTS.launch.sats, SPONSOR_SLOTS.all.sats]).toEqual([10_000, 25_000, 35_000]);
  });
  it("payment must reach the price and come from the signer", () => {
    const tx = (sats: number, from = P) => ({ vin: [{ prevout: { scriptpubkey_address: from } }], vout: [{ scriptpubkey_address: T, value: sats }] });
    expect(sponsorPaymentOk(tx(10_000), "cafe", P, T)).toBe(true);
    expect(sponsorPaymentOk(tx(9_999), "cafe", P, T)).toBe(false);
    expect(sponsorPaymentOk(tx(10_000), "launch", P, T)).toBe(false);
    expect(sponsorPaymentOk(tx(35_000, "bc1qother"), "all", P, T)).toBe(false);
  });
  it("a slot shows only on its screens for its 24h window", () => {
    const s = { slot: "cafe" as const, startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-02T00:00:00Z" };
    expect(slotLive(s, "cafe", Date.parse("2026-01-01T12:00:00Z"))).toBe(true);
    expect(slotLive(s, "launch", Date.parse("2026-01-01T12:00:00Z"))).toBe(false);
    expect(slotLive(s, "cafe", Date.parse("2026-01-02T00:00:01Z"))).toBe(false);
  });
  it("media is an inscription id or https image only", () => {
    expect(parseSponsorMedia("c47f5b4c6ef7351465f4ae4d88641fe77cab3303b0996fd4a0b7e9e5c645941fi0")?.kind).toBe("inscription");
    expect(parseSponsorMedia("http://x.com/a.png")).toBeNull();
    expect(parseSponsorMedia("javascript:alert(1)")).toBeNull();
  });
});

describe("launch ticket", () => {
  it("costs 5,000 sats and must land on the seat holder", () => {
    expect(TICKET_SATS).toBe(5_000);
    expect(ticketRevealOk([{ scriptpubkey_address: "bc1pseat", value: 546 }, { scriptpubkey_address: T, value: 5_000 }], "bc1pseat", T)).toBe(true);
    expect(ticketRevealOk([{ scriptpubkey_address: "bc1pother", value: 546 }, { scriptpubkey_address: T, value: 5_000 }], "bc1pseat", T)).toBe(false);
    expect(ticketRevealOk([{ scriptpubkey_address: "bc1pseat", value: 546 }, { scriptpubkey_address: T, value: 4_999 }], "bc1pseat", T)).toBe(false);
  });
});
