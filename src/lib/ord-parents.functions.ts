import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ParentSpend } from "@/lib/ord-parents";

/**
 * Resolves the parents a creature mint should declare: the `<height>.bitmap`
 * held by the minting wallet, plus the BITMAPWIN master collection inscription.
 */
export const mintParentsFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        height: z.number().int().min(0).max(999_999),
        holderAddress: z.string().trim().min(14).max(120).optional(),
        bitmapInscriptionId: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[0-9a-f]{64}i\d+$/)
          .optional(),
        /** Inscribe step: refuse unless this block's Guardian was summoned (paid + confirmed). */
        requireAwake: z.boolean().optional(),
        /** Parcel reinscribe: target the live-held parcel child `<index>.<height>.bitmap` instead. */
        parcelIndex: z.number().int().min(0).max(100_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.requireAwake) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: g } = await supabaseAdmin
        .from("bitmon_guardians")
        .select("id")
        .eq("block_height", data.height)
        .maybeSingle();
      if (!g) {
        return {
          parents: [] as ParentSpend[],
          bitmapParentId: null,
          masterInscriptionId: null,
          notes: [`SUMMON FIRST — ${data.height}.BITMAP HAS NO AWAKE GUARDIAN YET`],
          collectionAddress: "",
          notAwake: true as boolean,
        };
      }
    }
    const { fetchParentSpend } = await import("@/lib/ord-parents");
    const { bitmapInscriptionFor } = await import("@/lib/land-skin.server");
    const { masterParentSpend, collectionAddress } = await import("@/lib/ord-parents.server");
    const { isBitmapInscription, scanWalletForBitmap } = await import("@/lib/bitmap-parent-scan.server");

    const notes: string[] = [];
    const parents: ParentSpend[] = [];

    let bitmapId: string | null = null;
    if (data.parcelIndex !== undefined) {
      // Parcel holders stamp onto their own parcel sat; the chain scan decides who holds it.
      const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
      const holders = await parcelHoldersFor(data.height).catch(() => null);
      const p = holders?.parcels.find((x) => x.index === data.parcelIndex);
      if (!p) notes.push(`PARCEL #${data.parcelIndex} OF ${data.height}.BITMAP IS NOT A VALID ON-CHAIN PARCEL`);
      else if (!data.holderAddress || p.ownerAddress !== data.holderAddress) notes.push(`YOUR CONNECTED WALLET DOES NOT HOLD PARCEL #${data.parcelIndex}`);
      else {
        const spend = await fetchParentSpend(p.inscriptionId.toLowerCase(), "wallet");
        if (!spend || spend.address !== data.holderAddress) notes.push("COULD NOT LOCATE YOUR PARCEL ON CHAIN RIGHT NOW");
        else { parents.push(spend); bitmapId = p.inscriptionId.toLowerCase(); }
      }
    } else if (data.bitmapInscriptionId) {
      // User-supplied id: accept only if its on-chain content is exactly <height>.bitmap.
      if (await isBitmapInscription(data.bitmapInscriptionId, data.height)) bitmapId = data.bitmapInscriptionId;
      else notes.push(`THAT INSCRIPTION IS NOT ${data.height}.BITMAP`);
    }
    const isParcel = data.parcelIndex !== undefined;
    if (!isParcel && !bitmapId && !data.bitmapInscriptionId) bitmapId = await bitmapInscriptionFor(data.height).catch(() => null);
    if (!isParcel && !bitmapId && !data.bitmapInscriptionId && data.height >= 942_000) {
      // LiveOCI: read the blocks themselves for the first valid <height>.bitmap.
      const { resolveBitmapFromChain } = await import("@/lib/bitmap-live-resolver.server");
      bitmapId = await resolveBitmapFromChain(data.height).catch(() => null);
    }
    if (!isParcel && !bitmapId && !data.bitmapInscriptionId && data.holderAddress) {
      bitmapId = await scanWalletForBitmap(data.holderAddress, data.height).catch(() => null);
      if (bitmapId) notes.push(`FOUND ${data.height}.BITMAP IN YOUR WALLET`);
    }
    if (bitmapId && !isParcel) {
      // Save verified finds so this block resolves instantly next time.
      const { learnBitmap } = await import("@/lib/bitmap-live-resolver.server");
      const canonical = await learnBitmap(bitmapId, data.height).catch(() => null);
      if (canonical && canonical !== bitmapId.toLowerCase()) {
        notes.push(`AN EARLIER ${data.height}.BITMAP CLAIM EXISTS — ONLY THE FIRST INSCRIPTION COUNTS`);
        bitmapId = null;
      }
    }
    if (isParcel) {
      // parcel spend already pushed above
    } else if (!bitmapId) {
      notes.push(`COULD NOT FIND THE INSCRIPTION FOR ${data.height}.BITMAP — PASTE ITS INSCRIPTION ID`);
    } else {
      const spend = await fetchParentSpend(bitmapId.toLowerCase(), "wallet");
      if (!spend) notes.push("COULD NOT LOCATE THAT BITMAP ON CHAIN RIGHT NOW");
      else if (data.holderAddress && spend.address !== data.holderAddress) {
        notes.push("THAT BITMAP IS NOT IN THE CONNECTED WALLET, SO IT CANNOT BE CLAIMED AS A PARENT");
      } else parents.push(spend);
    }

    let master: string | null = null;
    let address = "";
    try {
      const res = await masterParentSpend();
      address = res.address;
      if (res.spend) {
        parents.push(res.spend);
        master = res.spend.inscriptionId;
      } else if (res.reason) notes.push(res.reason);
    } catch (e) {
      notes.push((e as Error).message);
    }
    if (!address) {
      try {
        address = collectionAddress();
      } catch {
        address = "";
      }
    }

    const bitmapParentId = bitmapId && parents.some((p) => p.inscriptionId === bitmapId.toLowerCase()) ? bitmapId.toLowerCase() : null;
    return { parents, notes, masterInscriptionId: master, bitmapParentId, collectionAddress: address, notAwake: false as boolean };
  });

/** Co-signs the master collection input of a creature reveal. */
export const signCollectionParentFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ psbt: z.string().min(40).max(400_000) }).parse(input))
  .handler(async ({ data }) => {
    const { signCollectionInputs } = await import("@/lib/ord-parents.server");
    return signCollectionInputs(data.psbt);
  });

/** Setup status of the master collection parent. */
export const collectionParentStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { masterParentSpend } = await import("@/lib/ord-parents.server");
  try {
    const res = await masterParentSpend();
    return {
      address: res.address,
      masterInscriptionId: res.spend?.inscriptionId ?? null,
      ready: Boolean(res.spend),
      reason: res.reason,
    };
  } catch (e) {
    return { address: "", masterInscriptionId: null, ready: false, reason: (e as Error).message };
  }
});
