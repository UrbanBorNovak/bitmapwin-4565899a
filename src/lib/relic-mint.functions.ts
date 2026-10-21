import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Live chain lookup of who holds <height>.bitmap right now (never browser-claimed). */
export const relicHolderFn = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ height: z.number().int().min(0).max(9_999_999) }).parse(i))
  .handler(async ({ data }) => {
    const { bitmapInscriptionFor } = await import("@/lib/land-skin.server");
    const { fetchParentSpend } = await import("@/lib/ord-parents");
    const id = await bitmapInscriptionFor(data.height).catch(() => null);
    if (!id) return { holderAddress: null as string | null, bitmapId: null as string | null, note: `COULD NOT FIND ${data.height}.BITMAP` };
    const spend = await fetchParentSpend(id.toLowerCase(), "wallet").catch(() => null);
    if (!spend) return { holderAddress: null as string | null, bitmapId: id, note: "COULD NOT LOCATE THE BITMAP ON CHAIN RIGHT NOW" };
    return { holderAddress: spend.address as string | null, bitmapId: id, note: "" };
  });

/** Unsigned reveal preview: both parents verified live, tribute outputs, dust, miner fee. Never signs. */
export const relicPreviewFn = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({
    height: z.number().int().min(0).max(9_999_999),
    tip: z.number().int().min(0),
    minterAddress: z.string().trim().min(14).max(120),
    feeRate: z.number().min(1).max(2000),
    metadataBytes: z.number().int().min(0).max(400_000),
  }).parse(i))
  .handler(async ({ data }) => {
    const { bitmapInscriptionFor } = await import("@/lib/land-skin.server");
    const { fetchParentSpend } = await import("@/lib/ord-parents");
    const { masterParentSpend } = await import("@/lib/ord-parents.server");
    const { buildRelicPreview, RELIC_VIEWER_INSCRIPTION_ID, viewerVerified } = await import("@/lib/relic-mint-preview");
    const { DONATION_ADDRESS } = await import("@/lib/donations");
    const notes: string[] = [];
    const parents = [];
    const bmId = await bitmapInscriptionFor(data.height).catch(() => null);
    const bm = bmId ? await fetchParentSpend(bmId.toLowerCase(), "wallet").catch(() => null) : null;
    if (bm) parents.push(bm); else notes.push(`${data.height}.BITMAP NOT LOCATED`);
    const master = await masterParentSpend().catch((e) => ({ spend: null, reason: (e as Error).message, address: "" }));
    if (master.spend) parents.push(master.spend); else notes.push(master.reason ?? "COLLECTION PARENT NOT LOCATED");
    let viewerType: string | null = null;
    if (RELIC_VIEWER_INSCRIPTION_ID) {
      const r = await fetch(`https://ordinals.com/r/inscription/${RELIC_VIEWER_INSCRIPTION_ID}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
      viewerType = r?.ok ? ((await r.json().catch(() => null)) as { content_type?: string } | null)?.content_type ?? null : null;
    }
    const res = buildRelicPreview({
      height: data.height, tip: data.tip, parents, notes,
      bitmapParentId: bm ? bm.inscriptionId : null, masterInscriptionId: master.spend?.inscriptionId ?? null,
      holderAddress: bm?.address ?? null, treasuryAddress: DONATION_ADDRESS,
      minterAddress: data.minterAddress, feeRate: data.feeRate, metadataBytes: data.metadataBytes,
      viewerOk: viewerVerified(RELIC_VIEWER_INSCRIPTION_ID, viewerType),
    });
    return res.ok ? res : { ok: false as const, message: res.message + (notes.length ? ` (${notes.join(" · ")})` : "") };
  });
