import { describe, expect, it } from "vitest";
import { mergeTrade } from "./trade-merge";
import type { TradeRow } from "./trade-store";

const row = (txid: string, block: number | null, price = 1000): TradeRow => ({
  txid, bitmap_height: 1, inscription_id: null, seller_address: null, buyer_address: null,
  price_sats: price, block_height: block, block_time: null, hop: 1, created_at: "2026-10-16T00:00:00Z",
});

describe("mergeTrade", () => {
  it("puts a newer block first", () => {
    expect(mergeTrade([row("a", 100)], row("b", 101)).map((r) => r.txid)).toEqual(["b", "a"]);
  });
  it("replaces an existing txid instead of duplicating", () => {
    const out = mergeTrade([row("a", null, 0)], row("a", 102, 5000));
    expect(out).toHaveLength(1);
    expect(out[0]!.block_height).toBe(102);
  });
  it("keeps at most the cap", () => {
    expect(mergeTrade([row("a", 100), row("b", 99)], row("c", 101), 2).map((r) => r.txid)).toEqual(["c", "a"]);
  });
});
