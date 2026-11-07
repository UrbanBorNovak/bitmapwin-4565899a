// @ts-nocheck — in-memory fake database and chain fixtures; behaviour is asserted at runtime.
/**
 * Seller lifecycle with deterministic fixtures: List → Change price → Unlist,
 * plus a bulk run. Listing PSBTs are built by the real builder and signed with
 * a throwaway key (SIGHASH_SINGLE|ANYONECANPAY); unlists are real BIP-322
 * signatures. The chain and database are in-memory fakes; nothing is broadcast.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ecc from "@bitcoinerlab/secp256k1";
import { ECPairFactory } from "ecpair";
import * as bitcoin from "bitcoinjs-lib";
import { Signer } from "bip322-js";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const KEY = ECPair.fromPrivateKey(Buffer.alloc(32, 7), { network: bitcoin.networks.bitcoin });
const SELLER = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(KEY.publicKey) }).address!;
const OTHER_KEY = ECPair.fromPrivateKey(Buffer.alloc(32, 9), { network: bitcoin.networks.bitcoin });

// ---------- fixtures: three BITMAPs held by SELLER ----------
const BITMAPS = [840000, 840001, 840002].map((h, i) => ({
  height: h,
  outpoint: `${String(i + 1).repeat(64).slice(0, 64).replace(/[^0-9]/g, "a")}:0`,
  inscription: `${"c".repeat(63)}${i}i0`,
}));
const chain = new Map<string, { inscription: string; height: number; spent: boolean }>();

// ---------- in-memory database ----------
let tables: Record<string, any[]> = {};
let clock = 0;
function query(table: string) {
  const rows = () => (tables[table] ??= []);
  const filters: Array<(r: any) => boolean> = [];
  let patch: any = null;
  const run = () => {
    const m = rows().filter((r) => filters.every((f) => f(r)));
    if (patch) m.forEach((r) => Object.assign(r, patch));
    return m;
  };
  const b: any = {
    select: () => b,
    update: (p: any) => ((patch = p), b),
    insert: (row: any) => {
      const r = { id: crypto.randomUUID(), created_at: new Date(Date.UTC(2026, 10, 7) + ++clock * 1000).toISOString(), ...row };
      rows().push(r);
      filters.push((x) => x === r);
      return b;
    },
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    ilike: (k: string, v: string) => (filters.push((r) => String(r[k]).toLowerCase() === v.toLowerCase()), b),
    order: () => b,
    limit: () => b,
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0], error: null }),
    then: (res: any) => res({ data: run(), error: null }),
  };
  return b;
}
const fakeDb = { from: (t: string) => query(t) };

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeDb }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: fakeDb }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => fakeDb }));
globalThis.fetch = vi.fn(async (url: string) => {
  const u = String(url);
  const out = /\/output\/([0-9a-f]{64}:\d+)/.exec(u);
  if (out) {
    const c = chain.get(out[1]!);
    if (!c) return new Response("nope", { status: 404 });
    return Response.json({ address: SELLER, inscriptions: [c.inscription], outpoint: out[1], spent: c.spent, value: 546 });
  }
  const content = /\/content\/(\w+)/.exec(u);
  if (content) {
    const c = [...chain.values()].find((x) => x.inscription === content[1]);
    return new Response(c ? `${c.height}.bitmap` : "", { status: c ? 200 : 404 });
  }
  return new Response("offline fixture", { status: 404 });
}) as any;

const { buildListingPsbt } = await import("@/lib/psbt-builder");
const { submitOffer, cancelOffer } = await import("@/lib/offers.server");
const submitOfferFn = ({ data }) => submitOffer(data.psbt);
const cancelOfferFn = ({ data }) => cancelOffer(data.offerId, data.signature);
const { unlistMessage, fetchSellerOffers, openOffersByOutpoint } = await import("@/lib/offers");

/** Fake wallet: signs the seller input exactly as UniSat/Xverse are asked to. */
function signListing(psbt: string, key = KEY) {
  const p = bitcoin.Psbt.fromBase64(psbt);
  p.signInput(0, { publicKey: Buffer.from(key.publicKey), sign: (h: Buffer) => Buffer.from(key.sign(h)) }, [0x83]);
  return p.toBase64();
}
const signUnlist = (id: string) => Signer.sign(KEY.toWIF(), SELLER, unlistMessage(id)) as string;

async function list(i: number, priceSats: number) {
  const [txid, vout] = BITMAPS[i]!.outpoint.split(":");
  const psbt = buildListingPsbt({ txid: txid!, vout: Number(vout), utxoValueSats: 546, sellerAddress: SELLER, priceSats });
  return submitOfferFn({ data: { psbt: signListing(psbt) } });
}
/** What My Land shows after a refresh: the saved state re-read from the database. */
async function myLand() {
  const map = openOffersByOutpoint(await fetchSellerOffers(SELLER));
  return BITMAPS.map((b) => map.get(b.outpoint)?.priceSats ?? null);
}

beforeEach(() => {
  tables = { offers: [], activity: [], bitmap_index: [] };
  chain.clear();
  for (const b of BITMAPS) chain.set(b.outpoint, { inscription: b.inscription, height: b.height, spent: false });
});

describe("seller listing lifecycle", () => {
  it("lists a BITMAP and the saved ask survives a refresh", async () => {
    const stored = await list(0, 123_000);
    expect(stored).toMatchObject({ bitmapHeight: 840000, priceSats: 123_000, status: "open", sellerAddress: SELLER });
    expect(await myLand()).toEqual([123_000, null, null]);
  });

  it("re-submitting the same signed listing does not create a second ask", async () => {
    const [txid, vout] = BITMAPS[0]!.outpoint.split(":");
    const signed = signListing(buildListingPsbt({ txid: txid!, vout: Number(vout), utxoValueSats: 546, sellerAddress: SELLER, priceSats: 50_000 }));
    await submitOfferFn({ data: { psbt: signed } });
    const again = await submitOfferFn({ data: { psbt: signed } });
    expect(again.duplicate).toBe(true);
    expect(tables.offers).toHaveLength(1);
  });

  it("changing the price leaves only the new ask open", async () => {
    const old = await list(0, 100_000);
    const next = await list(0, 200_000);
    await cancelOfferFn({ data: { offerId: old.id, signature: signUnlist(old.id) } });
    expect(tables.offers.find((o) => o.id === old.id).status).toBe("cancelled");
    expect(tables.offers.find((o) => o.id === next.id).status).toBe("open");
    expect(await myLand()).toEqual([200_000, null, null]);
  });

  it("if the old ask's unlist is declined, My Land still shows the new price", async () => {
    await list(0, 100_000);
    await list(0, 200_000);
    expect(await myLand()).toEqual([200_000, null, null]);
  });

  it("unlisting removes the ask after a refresh", async () => {
    const o = await list(1, 75_000);
    const r = await cancelOfferFn({ data: { offerId: o.id, signature: signUnlist(o.id) } });
    expect(r.ok).toBe(true);
    expect(await myLand()).toEqual([null, null, null]);
    expect(tables.activity.at(-1)).toMatchObject({ type: "listing_cancelled" });
  });

  it("refuses an unlist signed by another key", async () => {
    const o = await list(1, 75_000);
    const otherAddr = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(OTHER_KEY.publicKey) }).address!;
    const forged = Signer.sign(OTHER_KEY.toWIF(), otherAddr, unlistMessage(o.id)) as string;
    await expect(cancelOfferFn({ data: { offerId: o.id, signature: forged } })).rejects.toThrow();
    expect(await myLand()).toEqual([null, 75_000, null]);
  });

  it("bulk lists three BITMAPS, then bulk unlists them", async () => {
    const prices = [10_000, 20_000, 30_000];
    const stored = [];
    for (let i = 0; i < 3; i++) stored.push(await list(i, prices[i]!));
    expect(await myLand()).toEqual(prices);
    for (const s of stored) await cancelOfferFn({ data: { offerId: s.id, signature: signUnlist(s.id) } });
    expect(await myLand()).toEqual([null, null, null]);
  });

  it("refuses to list a BITMAP whose output was already spent", async () => {
    chain.get(BITMAPS[0]!.outpoint)!.spent = true;
    await expect(list(0, 10_000)).rejects.toThrow(/SPENT/);
    expect(await myLand()).toEqual([null, null, null]);
  });
});
