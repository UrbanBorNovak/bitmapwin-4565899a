import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { traitsOf } from "@/lib/traits";

const input = z.object({ address: z.string().trim().min(16).max(120) });

export const claimTraitHolderMembershipFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { assertControls } = await import("@/lib/coins.server");
    const { fetchWallet } = await import("@/lib/wallet.server");
    await assertControls(context.supabase, context.userId, data.address);

    const wallet = await fetchWallet(data.address, 400);
    if (wallet.scannedOutputs < wallet.utxoCount) {
      throw new Error("CHAIN OWNERSHIP CHECK INCOMPLETE — CONSOLIDATE WALLET OUTPUTS OR TRY AGAIN SHORTLY");
    }
    const held = wallet.utxos.flatMap((utxo) => utxo.inscriptions)
      .map((inscription) => ({ inscription, traits: inscription.bitmapHeight === null ? [] : traitsOf(inscription.bitmapHeight) }))
      .find((item) => item.inscription.bitmapHeight !== null && item.traits.length > 0);
    if (!held || held.inscription.bitmapHeight === null) {
      return { claimed: false as const, bitmapHeight: null, inscriptionId: null, traits: [] as string[] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 86_400_000).toISOString();
    const traitIds = held.traits.map((trait) => trait.id);
    const proof = {
      address: data.address.toLowerCase(),
      trait_ids: traitIds,
      bitmap_height: held.inscription.bitmapHeight,
      inscription_id: held.inscription.id,
      active: true,
      verified_at: now.toISOString(),
      expires_at: expiresAt,
    };
    const badgeWrite = await supabaseAdmin.from("trait_holder_badges").upsert(proof, { onConflict: "address" });
    if (badgeWrite.error) throw new Error(badgeWrite.error.message);

    const existing = await supabaseAdmin.from("memberships").select("address, expires_at").eq("address", data.address).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    const currentExpiry = existing.data?.expires_at ? Date.parse(existing.data.expires_at) : 0;
    const membership = {
      address: data.address,
      user_id: context.userId,
      status: "active",
      invoice_sats: 0,
      txid: held.inscription.id,
      paid_at: now.toISOString(),
      expires_at: currentExpiry > Date.parse(expiresAt) ? (existing.data?.expires_at ?? expiresAt) : expiresAt,
      source: "official-trait",
      qualifying_trait: traitIds[0] ?? null,
    };
    const membershipWrite = existing.data
      ? await supabaseAdmin.from("memberships").update(membership).eq("address", data.address)
      : await supabaseAdmin.from("memberships").insert(membership);
    if (membershipWrite.error) throw new Error(membershipWrite.error.message);

    return { claimed: true as const, bitmapHeight: held.inscription.bitmapHeight, inscriptionId: held.inscription.id, traits: traitIds };
  });