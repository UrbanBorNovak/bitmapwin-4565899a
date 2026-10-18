// @ts-nocheck — in-memory fake database fixtures; behavior is asserted at runtime.
/**
 * End-to-end checks of the public trading API with locally generated keys.
 * Every signature is a real BIP-322 signature made in-process from a throwaway
 * key; the database is an in-memory fake and the network broadcast is stubbed,
 * so nothing touches the chain and no bitcoin is ever spent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ecc from "@bitcoinerlab/secp256k1";
import { ECPairFactory } from "ecpair";
import * as bitcoin from "bitcoinjs-lib";
import { Signer } from "bip322-js";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

function wallet(seed: number) {
  const key = ECPair.fromPrivateKey(Buffer.alloc(32, seed), { network: bitcoin.networks.bitcoin });
  const address = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(key.publicKey) }).address!;
  return { wif: key.toWIF(), address };
}
const SELLER = wallet(1);
const BUYER = wallet(2);
const ATTACKER = wallet(3);
const sign = (w: { wif: string; address: string }, msg: string) => Signer.sign(w.wif, w.address, msg) as string;

// ---------------- in-memory database ----------------
type Row = Record<string, unknown>;
const state = {
  tables: {} as Record<string, Row[]>,
  hits: new Map<string, number>(),
  sigs: new Set<string>(),
};

function query(table: string) {
  const rows = () => (state.tables[table] ??= []);
  const filters: Array<(r: Row) => boolean> = [];
  let op: { kind: "select" | "update" | "insert"; patch?: Row; head?: boolean } = { kind: "select" };
  const run = () => {
    const matched = rows().filter((r) => filters.every((f) => f(r)));
    if (op.kind === "update") matched.forEach((r) => Object.assign(r, op.patch));
    return matched;
  };
  const b: Record<string, unknown> = {
    select: (_c?: string, o?: { head?: boolean }) => {
      if (op.kind === "select") op = { kind: "select", head: o?.head };
      return b;
    },
    update: (patch: Row) => ((op = { kind: "update", patch }), b),
    insert: (row: Row) => {
      const r = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
      rows().push(r);
      filters.push((x) => x === r);
      return b;
    },
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
    gt: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "") > v), b),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
    upsert: (row: Row) => (rows().push(row), b),
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0], error: null }),
    then: (res: (v: unknown) => void) => {
      const m = run();
      res({ data: op.head ? null : m, count: m.length, error: null });
    },
  };
  return b;
}

const fakeDb = {
  from: (t: string) => query(t),
  rpc: async (fn: string, a: Record<string, unknown>) => {
    if (fn === "market_api_hit") {
      const n = (state.hits.get(a._bucket as string) ?? 0) + 1;
      state.hits.set(a._bucket as string, n);
      return { data: n <= (a._limit as number), error: null };
    }
    if (fn === "market_api_claim_signature") {
      if (state.sigs.has(a._hash as string)) return { data: false, error: null };
      state.sigs.add(a._hash as string);
      return { data: true, error: null };
    }
    return { data: null, error: { message: "unknown rpc" } };
  },
};

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeDb }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => fakeDb }));
vi.mock("@/lib/psbt-buyer", async (orig) => ({
  ...(await orig<typeof import("@/lib/psbt-buyer")>()),
  // Fixtures carry no real seller signature; treat them as fully signed.
  finalizeSignedPsbt: (p: string) => p,
  inputSignatureReport: () => [{ index: 0, isFinal: true, hasSignature: true }],
  extractRawTxHex: () => "00",
}));
vi.mock("@/lib/purchase.server", async (orig) => ({
  ...(await orig<typeof import("@/lib/purchase.server")>()),
  // Reaching buildPurchase means every guard passed; skip chain lookups.
  buildPurchase: async (d: { offerId: string }) => ({ ok: true, offerId: d.offerId }),
}));

const { Route } = await import("@/routes/api/public/market.$");
const G = await import("@/lib/market-api-guard");
const { submitPurchase } = await import("@/lib/purchase.server");
const { addressToScriptPubKey } = await import("@/lib/psbt-builder");

let ip = 0;
async function call(path: string, body: unknown, from = `10.0.0.${ip}`) {
  const POST = (Route.options as any).server.handlers.POST;
  const res: Response = await POST({
    request: new Request(`http://x/api/public/market/${path}`, {
      method: "POST",
      headers: { "cf-connecting-ip": from },
      body: JSON.stringify(body),
    }),
    params: { _splat: path },
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

const now = () => new Date().toISOString();
const OFFER_ID = "11111111-1111-4111-8111-111111111111";
const BID_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  ip += 1;
  state.hits.clear();
  state.sigs.clear();
  state.tables = {
    offers: [
      { id: OFFER_ID, status: "open", seller_address: SELLER.address, price_sats: 50_000, psbt_base64: "x", outpoint: `${"ab".repeat(32)}:0` },
    ],
    bids: [{ id: BID_ID, bitmap_height: 840000, bidder_address: BUYER.address, price_sats: 20_000, status: "open" }],
    activity: [],
  };
});

describe("signed bids", () => {
  it("accepts a valid locally signed bid", async () => {
    const t = now();
    const r = await call("bids", {
      bitmapHeight: 840000, bidderAddress: BUYER.address, priceSats: 30_000, issuedAt: t,
      signature: sign(BUYER, G.bidApiMessage(840000, 30_000, BUYER.address, t)),
    });
    expect(r.status).toBe(201);
    expect(r.body.bid.price_sats).toBe(30_000);
  });

  it("refuses the same signature a second time (replay)", async () => {
    const t = now();
    const body = {
      bitmapHeight: 840000, bidderAddress: BUYER.address, priceSats: 30_000, issuedAt: t,
      signature: sign(BUYER, G.bidApiMessage(840000, 30_000, BUYER.address, t)),
    };
    expect((await call("bids", body)).status).toBe(201);
    expect((await call("bids", body)).status).toBe(409);
  });

  it("refuses a signature older than 10 minutes", async () => {
    const t = new Date(Date.now() - 11 * 60_000).toISOString();
    const r = await call("bids", {
      bitmapHeight: 840000, bidderAddress: BUYER.address, priceSats: 30_000, issuedAt: t,
      signature: sign(BUYER, G.bidApiMessage(840000, 30_000, BUYER.address, t)),
    });
    expect(r.status).toBe(401);
  });

  it("refuses a signature reused with a different price", async () => {
    const t = now();
    const r = await call("bids", {
      bitmapHeight: 840000, bidderAddress: BUYER.address, priceSats: 99_000, issuedAt: t,
      signature: sign(BUYER, G.bidApiMessage(840000, 30_000, BUYER.address, t)),
    });
    expect(r.status).toBe(401);
  });
});

describe("cancellations", () => {
  it("lets the seller unlist their own listing", async () => {
    const t = now();
    const r = await call("listings/cancel", {
      offerId: OFFER_ID, issuedAt: t, signature: sign(SELLER, G.unlistApiMessage(OFFER_ID, SELLER.address, t)),
    });
    expect(r.status).toBe(200);
    expect(state.tables.offers![0]!.status).toBe("cancelled");
  });

  it("refuses an unlist signed by another wallet", async () => {
    const t = now();
    const r = await call("listings/cancel", {
      offerId: OFFER_ID, issuedAt: t, signature: sign(ATTACKER, G.unlistApiMessage(OFFER_ID, SELLER.address, t)),
    });
    expect(r.status).toBe(401);
    expect(state.tables.offers![0]!.status).toBe("open");
  });

  it("refuses to cancel someone else's bid even with a valid own signature", async () => {
    const t = now();
    const r = await call("bids/cancel", {
      bidId: BID_ID, address: ATTACKER.address, issuedAt: t,
      signature: sign(ATTACKER, G.cancelBidApiMessage(BID_ID, ATTACKER.address, t)),
    });
    expect(r.status).toBe(422);
    expect(state.tables.bids![0]!.status).toBe("open");
  });

  it("lets the bidder cancel their own bid", async () => {
    const t = now();
    const r = await call("bids/cancel", {
      bidId: BID_ID, address: BUYER.address, issuedAt: t,
      signature: sign(BUYER, G.cancelBidApiMessage(BID_ID, BUYER.address, t)),
    });
    expect(r.status).toBe(200);
    expect(state.tables.bids![0]!.status).toBe("cancelled");
  });
});

describe("altered transactions", () => {
  // Safe layout: [pad, pad, seller, funding] → [pads back, BITMAP to buyer, price to seller]
  function fixturePsbt(sellerTo: string, sellerSats: number, deliverTo: string) {
    const p = new bitcoin.Psbt();
    const w = (addr: string, v: number) => ({ witnessUtxo: { script: Buffer.from(addressToScriptPubKey(addr)), value: BigInt(v) } as any });
    p.addInput({ hash: "01".repeat(32), index: 0, ...w(BUYER.address, 600) });
    p.addInput({ hash: "02".repeat(32), index: 0, ...w(BUYER.address, 600) });
    p.addInput({ hash: "ab".repeat(32), index: 0, ...w(SELLER.address, 546) });
    p.addInput({ hash: "03".repeat(32), index: 0, ...w(BUYER.address, 100_000) });
    p.addOutput({ script: Buffer.from(addressToScriptPubKey(BUYER.address)), value: BigInt(1200) } as any);
    p.addOutput({ script: Buffer.from(addressToScriptPubKey(deliverTo)), value: BigInt(546) } as any);
    p.addOutput({ script: Buffer.from(addressToScriptPubKey(sellerTo)), value: BigInt(sellerSats) } as any);
    return p.toBase64();
  }
  beforeEach(() => {
    Object.assign(state.tables.offers![0]!, { reserved_by: BUYER.address, reserved_until: new Date(Date.now() + 60_000).toISOString() });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("f".repeat(64))));
  });

  it("broadcasts an untouched transaction", async () => {
    const r = await submitPurchase({ offerId: OFFER_ID, psbtBase64: fixturePsbt(SELLER.address, 50_000, BUYER.address), buyerAddress: BUYER.address });
    expect(r).toBeTruthy();
    expect(state.tables.offers![0]!.status).not.toBe("open");
  });
  it("refuses a lowered seller payout", async () => {
    await expect(
      submitPurchase({ offerId: OFFER_ID, psbtBase64: fixturePsbt(SELLER.address, 49_999, BUYER.address), buyerAddress: BUYER.address }),
    ).rejects.toThrow(/seller payout output was altered/);
  });
  it("refuses a redirected seller payout", async () => {
    await expect(
      submitPurchase({ offerId: OFFER_ID, psbtBase64: fixturePsbt(ATTACKER.address, 50_000, BUYER.address), buyerAddress: BUYER.address }),
    ).rejects.toThrow(/seller payout output was altered/);
  });
  it("refuses an inscription sent to another address", async () => {
    await expect(
      submitPurchase({ offerId: OFFER_ID, psbtBase64: fixturePsbt(SELLER.address, 50_000, ATTACKER.address), buyerAddress: BUYER.address }),
    ).rejects.toThrow(/not delivered to your address/);
  });
  it("refuses a buyer without the live hold", async () => {
    await expect(
      submitPurchase({ offerId: OFFER_ID, psbtBase64: fixturePsbt(SELLER.address, 50_000, ATTACKER.address), buyerAddress: ATTACKER.address }),
    ).rejects.toThrow(/reserved by another buyer/);
  });
});

describe("reservation limits", () => {
  const prepare = (offerId: string, from?: string) =>
    call("buy/prepare", { offerId, buyerPaymentAddress: BUYER.address, buyerOrdinalsAddress: BUYER.address }, from);

  it("caps a buyer at 2 live holds", async () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    for (const n of [3, 4]) {
      state.tables.offers!.push({ id: `0000000${n}-0000-4000-8000-000000000000`, status: "open", reserved_by: BUYER.address, reserved_until: soon });
    }
    const r = await prepare(OFFER_ID);
    expect(r.status).toBe(429);
    expect(r.body.error).toMatch(/max 2/);
  });

  it("allows 6 hold attempts per minute per wallet, then 429", async () => {
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await prepare(OFFER_ID, `10.9.${ip}.${i}`)).status);
    expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(statuses[6]).toBe(429);
  });

  it("allows 20 writes per minute per IP, then 429", async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await call("bids", {}, "10.8.8.8")).status;
    expect(last).toBe(429);
  });
});
