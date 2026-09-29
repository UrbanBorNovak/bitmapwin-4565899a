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
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { fetchParentSpend } = await import("@/lib/ord-parents");
    const { bitmapInscriptionFor } = await import("@/lib/land-skin.server");
    const { masterParentSpend, collectionAddress } = await import("@/lib/ord-parents.server");

    const notes: string[] = [];
    const parents: ParentSpend[] = [];

    const bitmapId = await bitmapInscriptionFor(data.height).catch(() => null);
    if (!bitmapId) {
      notes.push(`COULD NOT FIND THE INSCRIPTION FOR ${data.height}.BITMAP`);
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

    return { parents, notes, masterInscriptionId: master, collectionAddress: address };
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
