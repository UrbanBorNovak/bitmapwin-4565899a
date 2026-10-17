import { describe, expect, it } from "vitest";
import { BitmapWinApiError, BitmapWinClient } from "./bitmapwin-client";
import { bidApiMessage } from "./market-api-guard";

function mock(status = 200, body: unknown = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("BitmapWinClient", () => {
  it("builds listing queries and skips empty params", async () => {
    const m = mock(200, { listings: [], limit: 5, offset: 0 });
    await new BitmapWinClient({ baseUrl: "https://x.test/", fetch: m.f }).market.listings({ max_sats: 1000, limit: 5 });
    expect(m.calls[0].url).toBe("https://x.test/api/public/market/listings?max_sats=1000&limit=5");
    expect(m.calls[0].init?.method).toBe("GET");
  });

  it("posts JSON for bids", async () => {
    const m = mock(201, { id: "b" });
    await new BitmapWinClient({ fetch: m.f }).market.placeBid({
      bitmapHeight: 1, bidderAddress: "bc1q", priceSats: 600, issuedAt: "t", signature: "s",
    });
    expect(m.calls[0].url).toBe("https://bitmapwin.app/api/public/market/bids");
    expect(m.calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(m.calls[0].init?.body)).priceSats).toBe(600);
  });

  it("throws the server error with status on 429", async () => {
    const m = mock(429, { error: "Rate limit exceeded" });
    const err = await new BitmapWinClient({ fetch: m.f }).market.orderbook().catch((e) => e);
    expect(err).toBeInstanceOf(BitmapWinApiError);
    expect(err.status).toBe(429);
    expect(err.message).toBe("Rate limit exceeded");
  });

  it("signs the same bid message the server verifies", () => {
    const c = new BitmapWinClient();
    expect(c.messages.bid(840000, 5000, "bc1q", "2026-01-01T00:00:00.000Z")).toBe(
      bidApiMessage(840000, 5000, "bc1q", "2026-01-01T00:00:00.000Z"),
    );
  });
});
