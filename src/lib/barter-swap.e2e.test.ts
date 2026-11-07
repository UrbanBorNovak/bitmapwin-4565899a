/**
 * BW-BARTER-1 N-for-1 end to end, offline: live chain reads are replaced by an
 * in-memory "chain", both wallets are throwaway keys signing with @scure/btc-signer,
 * and every signature is verified against the real BIP-341 / BIP-143 sighash.
 * Nothing is broadcast and no real funds exist.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as btc from "@scure/btc-signer";
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import { base64, hex } from "@scure/base";

type Out = { value: number; address: string; inscriptions: string[]; spent: boolean };
const chain = new Map<string, Out>();
const heights = new Map<string, number>();
const paymentUtxos = new Map<string, { txid: string; vout: number; value: number }[]>();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      let id = "";
      const q = {
        select: () => q,
        eq: (col: string, v: unknown) => { if (col === "inscription_id") id = String(v); return q; },
        maybeSingle: async () => ({ data: heights.has(id) ? { block_height: heights.get(id) } : null }),
      };
      return q;
    },
  },
}));
vi.mock("@/lib/offers.server", () => ({
  fetchOutput: async (op: string) => {
    const o = chain.get(op);
    return o ? { value: o.value, address: o.address, inscriptions: o.inscriptions, spent: o.spent } : null;
  },
}));
vi.mock("@/lib/ord-fallback.server", () => ({
  ordInscription: async (id: string) => {
    for (const [op, o] of chain) if (!o.spent && o.inscriptions[0] === id) return { satpoint: `${op}:0`, address: o.address, value: o.value };
    return null;
  },
}));
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
vi.stubGlobal("fetch", async (url: string) => {
  const u = String(url);
  let m = u.match(/\/output\/([0-9a-f]{64}:\d+)$/);
  if (m) { const o = chain.get(m[1]!); return o ? json({ inscriptions: o.inscriptions, value: o.value, spent: o.spent }) : new Response("", { status: 404 }); }
  m = u.match(/\/address\/([^/]+)\/utxo$/);
  if (m) return json((paymentUtxos.get(m[1]!) ?? []).map((x) => ({ ...x, status: { confirmed: true } })));
  if (u.endsWith("/v1/fees/recommended")) return json({ halfHourFee: 7 });
  return new Response("", { status: 404 });
});

const { buildSwap, reviewSwap } = await import("@/lib/barter-swap.server");
const { signMakerSwap } = await import("@/lib/barter-maker-sign");
const { finalizeSignedPsbt, isFullySigned, extractRawTxHex } = await import("@/lib/psbt-buyer");
import type { BarterTicket } from "@/lib/barter-protocol";
import type { ConnectedWallet, WalletProviderId } from "@/lib/browser-wallet";

/* ── throwaway wallets ─────────────────────────────────────────────── */
const key = (n: number) => { const k = new Uint8Array(32); k[31] = n; k[0] = 0x42; return k; };
const makerPriv = key(1), takerPriv = key(2), payPriv = key(3);
const xOnly = (p: Uint8Array) => schnorr.getPublicKey(p);
const makerTr = btc.p2tr(xOnly(makerPriv));
const takerTr = btc.p2tr(xOnly(takerPriv));
const payWpkh = btc.p2wpkh(secp256k1.getPublicKey(payPriv, true));
const MAKER = makerTr.address!, TAKER = takerTr.address!, PAY = payWpkh.address!;

const txid = (c: number) => c.toString(16).padStart(2, "0").repeat(32);
const signWith = (priv: Uint8Array) => async (_p: WalletProviderId, psbt: string, _addr: string, idx: number[]) => {
  const tx = btc.Transaction.fromPSBT(base64.decode(psbt), { allowUnknownOutputs: true });
  for (const i of idx) if (!tx.signIdx(priv, i)) throw new Error(`could not sign input ${i}`);
  return base64.encode(tx.toPSBT());
};
const makerWallet = { provider: "unisat", ordinalsAddress: MAKER, paymentAddress: MAKER, publicKey: hex.encode(xOnly(makerPriv)) } as ConnectedWallet;

function reset(n: number) {
  chain.clear(); heights.clear(); paymentUtxos.clear();
  chain.set(`${txid(1)}:0`, { value: 546, address: MAKER, inscriptions: [`${txid(1)}i0`], spent: false });
  for (let k = 0; k < n; k++) {
    const id = `${txid(10 + k)}i0`;
    chain.set(`${txid(10 + k)}:${k}`, { value: [600, 330, 10_000, 546, 1_000][k]!, address: TAKER, inscriptions: [id], spent: false });
    heights.set(id, 80_000 + k);
  }
  paymentUtxos.set(PAY, [{ txid: txid(50), vout: 1, value: 200_000 }]);
  chain.set(`${txid(50)}:1`, { value: 200_000, address: PAY, inscriptions: [], spent: false });
}
const ticket: BarterTicket = {
  makerAddress: MAKER, offeringOutpoint: `${txid(1)}:0`, offeringInscription: `${txid(1)}i0`, offeringValue: 546,
  sweetenerSats: 5_000, sweetenerDir: "demand", criteria: { assetType: "bitmap", maxHeight: 99_999 },
};
const items = (n: number) => Array.from({ length: n }, (_, k) => ({ inscription: `${txid(10 + k)}i0`, outpoint: `${txid(10 + k)}:${k}` }));
const propose = (n: number) => buildSwap({
  ticket, takerInscription: items(n)[0]!.inscription, takerOutpoint: items(n)[0]!.outpoint, moreItems: items(n).slice(1),
  takerOrdinalsAddress: TAKER, takerPaymentAddress: PAY,
  takerPublicKey: hex.encode(xOnly(takerPriv)), takerPaymentPublicKey: hex.encode(secp256k1.getPublicKey(payPriv, true)),
});
async function takerSigns(b: Awaited<ReturnType<typeof propose>>) {
  let p = await signWith(takerPriv)("unisat", b.psbtBase64, TAKER, b.takerAssetIndices);
  p = await signWith(payPriv)("unisat", p, PAY, b.fundingIndices);
  return p;
}

/** Ordinal theory FIFO: which output (and offset) the first sat of each input lands on. */
function firstSatDestinations(tx: btc.Transaction) {
  const ins: number[] = [], outs: number[] = [];
  for (let i = 0; i < tx.inputsLength; i++) ins.push(Number(tx.getInput(i).witnessUtxo!.amount));
  for (let o = 0; o < tx.outputsLength; o++) outs.push(Number(tx.getOutput(o).amount));
  let start = 0;
  return ins.map((v) => {
    let acc = 0, o = 0;
    while (o < outs.length && acc + outs[o]! <= start) acc += outs[o++]!;
    const r = o < outs.length ? { output: o, offset: start - acc } : { output: -1, offset: -1 };
    start += v;
    return r;
  });
}
/** Real signature checks: BIP-341 key path for taproot, BIP-143 for P2WPKH. */
function verifyAll(rawHex: string, prev: { script: Uint8Array; amount: bigint; priv: Uint8Array }[]) {
  const tx = btc.Transaction.fromRaw(hex.decode(rawHex), { allowUnknownOutputs: true });
  prev.forEach((p, i) => {
    const w = tx.getInput(i).finalScriptWitness!;
    if (p.script[0] === 0x51) {
      const sig = w[0]!;
      const hash = (tx as any).preimageWitnessV1(i, prev.map((x) => x.script), sig.length === 65 ? sig[64] : 0, prev.map((x) => x.amount));
      const outKey = p.script.slice(2);
      expect(schnorr.verify(sig.slice(0, 64), hash, outKey), `taproot sig ${i}`).toBe(true);
    } else {
      const [sigDer, pub] = w as Uint8Array[];
      const code = btc.OutScript.encode({ type: "pkh", hash: p.script.slice(2) });
      const hash = (tx as any).preimageWitnessV0(i, code, sigDer!.at(-1)!, p.amount);
      expect(secp256k1.verify(sigDer!.slice(0, -1), hash, pub!, { format: "der", prehash: false }), `segwit sig ${i}`).toBe(true);
    }
  });
  return tx;
}

describe.each([1, 5])("BW-BARTER-1 %i-for-1, both wallets sign offline", (n) => {
  beforeEach(() => reset(n));

  it("taker builds and signs, maker reviews and signs, signatures verify, every inscription lands right", async () => {
    const b = await propose(n);
    expect(b.takerAssetIndices).toEqual(Array.from({ length: n }, (_, k) => k + 1));
    expect(b.fundingIndices).toEqual([n + 1]);
    const takerSigned = await takerSigns(b);

    const seen = await reviewSwap(takerSigned, ticket);
    expect(seen.ok).toBe(true);
    if (!seen.ok) return;
    expect(seen.takers.map((t) => t.inscriptionId)).toEqual(items(n).map((i) => i.inscription));

    const both = await signMakerSwap(makerWallet, takerSigned, signWith(makerPriv));
    expect((await reviewSwap(both, ticket)).ok).toBe(true);
    const fin = finalizeSignedPsbt(both);
    expect(isFullySigned(fin)).toBe(true);
    const raw = extractRawTxHex(fin)!;

    const prev = [
      { script: makerTr.script, amount: 546n, priv: makerPriv },
      ...Array.from({ length: n }, (_, k) => ({ script: takerTr.script, amount: BigInt(chain.get(items(n)[k]!.outpoint)!.value), priv: takerPriv })),
      { script: payWpkh.script, amount: 200_000n, priv: payPriv },
    ];
    const tx = verifyAll(raw, prev);

    // Inscription destinations by FIFO: maker item → taker, each taker item → maker, all at offset 0.
    const dest = firstSatDestinations(tx);
    const addrOf = (o: number) => btc.Address().encode(btc.OutScript.decode(tx.getOutput(o).script!));
    expect(dest[0]).toEqual({ output: 0, offset: 0 });
    expect(addrOf(0)).toBe(TAKER);
    for (let k = 1; k <= n; k++) { expect(dest[k]).toEqual({ output: k, offset: 0 }); expect(addrOf(k)).toBe(MAKER); }
    expect(Number(tx.getOutput(n + 1).amount)).toBe(5_000);
    expect(addrOf(n + 1)).toBe(MAKER);

    // Fees: inputs − outputs equals the reported fee; rate lands at the asked 7 sat/vB or a little above.
    const inSum = prev.reduce((s, p) => s + Number(p.amount), 0);
    let outSum = 0; for (let o = 0; o < tx.outputsLength; o++) outSum += Number(tx.getOutput(o).amount);
    expect(inSum - outSum).toBe(b.feeSats);
    const rate = b.feeSats / tx.vsize;
    expect(rate).toBeGreaterThanOrEqual(7);
    expect(rate).toBeLessThan(7 * 1.25);
    expect(addrOf(tx.outputsLength - 1)).toBe(PAY); // change back to the taker's payment address
  });

  it("taker moving one bundled item cancels: review and broadcast checks refuse", async () => {
    const signed = await takerSigns(await propose(n));
    chain.get(items(n)[n - 1]!.outpoint)!.spent = true;
    const r = await reviewSwap(signed, ticket);
    expect(r).toEqual({ ok: false, reason: "matched item: output is spent" });
  });

  it("maker moving the offered item cancels", async () => {
    const signed = await takerSigns(await propose(n));
    chain.get(`${txid(1)}:0`)!.spent = true;
    expect(await reviewSwap(signed, ticket)).toMatchObject({ ok: false, reason: expect.stringMatching(/^offered item/) });
  });

  it("a postage change on a bundled item after signing is refused", async () => {
    const signed = await takerSigns(await propose(n));
    chain.get(items(n)[0]!.outpoint)!.value += 1;
    expect((await reviewSwap(signed, ticket)).ok).toBe(false);
  });

  it("an edited output after the taker signed breaks the taker's signature", async () => {
    const signed = await takerSigns(await propose(n));
    const tx = btc.Transaction.fromPSBT(base64.decode(signed), { allowUnknownOutputs: true });
    const o = tx.getOutput(n + 1);
    const outs = Array.from({ length: tx.outputsLength }, (_, i) => tx.getOutput(i));
    // Rebuild with the sweetener raised by 1 sat but keep the taker's old signatures.
    const forged = new btc.Transaction({ allowUnknownOutputs: true });
    for (let i = 0; i < tx.inputsLength; i++) forged.addInput(tx.getInput(i));
    outs.forEach((x, i) => forged.addOutput({ script: x.script!, amount: i === n + 1 ? o.amount! + 1n : x.amount! }));
    const both = await signMakerSwap(makerWallet, base64.encode(forged.toPSBT()), signWith(makerPriv));
    const raw = extractRawTxHex(finalizeSignedPsbt(both))!;
    const t2 = btc.Transaction.fromRaw(hex.decode(raw), { allowUnknownOutputs: true });
    const sig = t2.getInput(1).finalScriptWitness![0]!;
    const scripts = [makerTr.script, ...Array.from({ length: n }, () => takerTr.script), payWpkh.script];
    const amts = [546n, ...items(n).map((i) => BigInt(chain.get(i.outpoint)!.value)), 200_000n];
    const hash = (t2 as any).preimageWitnessV1(1, scripts, 0, amts);
    expect(schnorr.verify(sig.slice(0, 64), hash, takerTr.script.slice(2))).toBe(false);
  });
});

describe("BW-BARTER-1 bundle limits", () => {
  it("refuses six items and duplicate picks before anything is signed", async () => {
    reset(5);
    await expect(buildSwap({
      ticket, takerInscription: items(5)[0]!.inscription, takerOutpoint: items(5)[0]!.outpoint,
      moreItems: [...items(5).slice(1), items(5)[1]!], takerOrdinalsAddress: TAKER, takerPaymentAddress: PAY,
    })).rejects.toThrow(/At most 5/);
    await expect(buildSwap({
      ticket, takerInscription: items(2)[0]!.inscription, takerOutpoint: items(2)[0]!.outpoint,
      moreItems: [items(2)[0]!], takerOrdinalsAddress: TAKER, takerPaymentAddress: PAY,
    })).rejects.toThrow(/picked twice/);
  });
  it("refuses a bundle where one item breaks the offer's rules", async () => {
    reset(3);
    heights.set(items(3)[2]!.inscription, 150_000);
    await expect(propose(3)).rejects.toThrow(/does not meet/);
  });
});
