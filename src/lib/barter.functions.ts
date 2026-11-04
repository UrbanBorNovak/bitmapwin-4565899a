import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ORD = "https://ordinals.com";
const INS = /^[0-9a-f]{64}i\d+$/;

async function ordJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${ORD}${path}`, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Public read: current satpoints for up to 60 inscriptions, from ordinals.com. Null when unreadable. */
export const inscriptionSatpointsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().regex(INS)).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const out: Record<string, string | null> = {};
    const queue = [...new Set(data.ids)];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        const j = await ordJson<{ satpoint?: string }>(`/r/inscription/${id}`);
        out[id] = typeof j?.satpoint === "string" ? j.satpoint : null;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return out;
  });

const offerSchema = z.object({
  key: z.string().max(200),
  makerAddress: z.string().min(20).max(100),
  offeringOutpoint: z.string().regex(/^[0-9a-f]{64}:\d+$/),
  offeringInscription: z.string().regex(INS),
  offeringValue: z.number().int(),
  sweetenerSats: z.number().int(),
  sweetenerDir: z.enum(["give", "demand"]),
  criteria: z.record(z.string(), z.unknown()),
  nostrPubkey: z.string().regex(/^[0-9a-f]{64}$/),
  issuedAt: z.number().int(),
  signature: z.string().min(8).max(2000),
});

export type OfferVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Public, write-free check of barter offers: the maker's BIP-322 signature over the
 * exact offer text, and the live chain position of the offered inscription
 * (owned by the maker, first sat of its own unspent output). `fresh` also enforces
 * proof age, used right before publishing. Up to 30 offers per call.
 */
export const verifyBarterOffersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ offers: z.array(offerSchema).max(30), fresh: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { Verifier } = await import("bip322-js");
    const P = await import("@/lib/barter-protocol");
    const now = Math.floor(Date.now() / 1000);
    const out: Record<string, OfferVerdict> = {};
    for (const o of data.offers) {
      const ticket = { ...o, criteria: o.criteria as import("@/lib/barter-protocol").BarterCriteria };
      const bad = P.ticketProblem(ticket);
      if (bad) { out[o.key] = { ok: false, reason: bad }; continue; }
      if (o.issuedAt > now + 120) { out[o.key] = { ok: false, reason: "proof dated in the future" }; continue; }
      if (data.fresh && now - o.issuedAt > P.PROOF_MAX_AGE_S) { out[o.key] = { ok: false, reason: "proof expired, sign again" }; continue; }
      let valid = false;
      try { valid = Verifier.verifySignature(o.makerAddress, P.offerProofMessage(ticket, o.nostrPubkey, o.issuedAt), o.signature); } catch { valid = false; }
      if (!valid) { out[o.key] = { ok: false, reason: "wallet signature does not verify" }; continue; }
      const [ins, outp] = await Promise.all([
        ordJson<{ satpoint?: string; address?: string }>(`/r/inscription/${o.offeringInscription}`),
        ordJson<{ inscriptions?: string[]; spent?: boolean; value?: number; address?: string }>(`/output/${o.offeringOutpoint}`),
      ]);
      if (!ins || !outp) { out[o.key] = { ok: false, reason: "chain could not be read" }; continue; }
      if (outp.spent) { out[o.key] = { ok: false, reason: "offered output is spent" }; continue; }
      if ((ins.address ?? outp.address) !== o.makerAddress) { out[o.key] = { ok: false, reason: "maker no longer holds the inscription" }; continue; }
      if (outp.value !== o.offeringValue) { out[o.key] = { ok: false, reason: "postage differs from chain" }; continue; }
      const pos = P.satpointProblem({
        outpoint: o.offeringOutpoint, value: outp.value ?? 0, satpoint: ins.satpoint ?? null,
        inscriptionsInUtxo: outp.inscriptions?.length ?? 0,
      });
      out[o.key] = pos ? { ok: false, reason: pos } : { ok: true };
    }
    return out;
  });

const ticketSchema = z.object({
  makerAddress: z.string().min(20).max(100),
  offeringOutpoint: z.string().regex(/^[0-9a-f]{64}:\d+$/),
  offeringInscription: z.string().regex(INS),
  offeringValue: z.number().int(),
  sweetenerSats: z.number().int().min(0),
  sweetenerDir: z.enum(["give", "demand"]),
  criteria: z.record(z.string(), z.unknown()),
});
const asTicket = (t: z.infer<typeof ticketSchema>) => ({ ...t, criteria: t.criteria as import("@/lib/barter-protocol").BarterCriteria });
const psbtField = z.string().min(40).max(200_000);

/** Public: builds the unsigned swap for a taker after live checks of both items. Writes nothing. */
export const buildBarterSwapFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    ticket: ticketSchema,
    takerInscription: z.string().regex(INS),
    takerOutpoint: z.string().regex(/^[0-9a-f]{64}:\d+$/),
    takerOrdinalsAddress: z.string().min(20).max(100),
    takerPaymentAddress: z.string().min(20).max(100),
    takerPublicKey: z.string().regex(/^[0-9a-f]{64,66}$/i).optional(),
    takerPaymentPublicKey: z.string().regex(/^[0-9a-f]{64,66}$/i).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { buildSwap } = await import("@/lib/barter-swap.server");
    try {
      return { ok: true as const, ...(await buildSwap({ ...data, ticket: asTicket(data.ticket) })) };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "could not build the swap" };
    }
  });

/** Public: the maker's live check of a received swap proposal. Writes nothing. */
export const reviewBarterSwapFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ticket: ticketSchema, psbtBase64: psbtField }).parse(d))
  .handler(async ({ data }) => {
    const { reviewSwap } = await import("@/lib/barter-swap.server");
    const r = await reviewSwap(data.psbtBase64, asTicket(data.ticket));
    if (!r.ok) return r;
    const { decodePsbt } = await import("@/lib/psbt");
    const d = decodePsbt(data.psbtBase64);
    const takerSigned = d.inputs.slice(1).every((i) => i.signed);
    return { ok: true as const, feeSats: r.feeSats, takerSigned, takerAsset: { id: r.taker.inscriptionId, height: r.taker.height ?? null, value: r.taker.value }, outputs: r.layout.outputs };
  });

/** Public: re-checks a fully signed swap, finalizes and broadcasts it. Bitcoin itself rejects anything unsigned. */
export const broadcastBarterSwapFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ticket: ticketSchema, psbtBase64: psbtField }).parse(d))
  .handler(async ({ data }) => {
    const { reviewSwap } = await import("@/lib/barter-swap.server");
    const r = await reviewSwap(data.psbtBase64, asTicket(data.ticket));
    if (!r.ok) return r;
    const { finalizeSignedPsbt, isFullySigned, extractRawTxHex } = await import("@/lib/psbt-buyer");
    let finalized: string;
    try { finalized = finalizeSignedPsbt(data.psbtBase64); } catch { return { ok: false as const, reason: "signatures could not be finalized" }; }
    if (!isFullySigned(finalized)) return { ok: false as const, reason: "not every input is signed" };
    const raw = extractRawTxHex(finalized);
    if (!raw) return { ok: false as const, reason: "transaction could not be extracted" };
    const { broadcastRawTransaction } = await import("@/lib/purchase.server");
    const b = await broadcastRawTransaction(raw);
    return "txid" in b ? { ok: true as const, txid: b.txid } : { ok: false as const, reason: `Bitcoin rejected it: ${b.error.slice(0, 160)}` };
  });
