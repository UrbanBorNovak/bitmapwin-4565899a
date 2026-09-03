import { locateBitmap } from "@/lib/locate-bitmap.server";
import { validateOnChainGlb } from "@/lib/bitmap-model-validation.server";

type Placement = { height: number; inscriptionId: string; scale: number; rotationY: number; heightOffset: number };

async function linkedAddresses(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("wallet_links").select("address").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.address);
}

async function liveOwner(userId: string, height: number) {
  const addresses = await linkedAddresses(userId);
  if (addresses.length === 0) throw new Error("LINK A BITCOIN WALLET BEFORE PLACING A MODEL");
  for (const address of addresses) {
    const location = await locateBitmap({ height, address });
    if (location.heldByAddress) return address;
  }
  throw new Error("YOUR LINKED WALLETS DO NOT HOLD THIS BITMAP ON CHAIN");
}

export async function publishBitmapModel(userId: string, input: Placement) {
  const ownerAddress = await liveOwner(userId, input.height);
  const validated = await validateOnChainGlb(input.inscriptionId);
  const validationNote = "STRICT GLB VALIDATION PASSED · DRACO SUPPORTED";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("bitmap_models").upsert({
    bitmap_height: input.height,
    owner_address: ownerAddress,
    inscription_id: input.inscriptionId,
    scale: input.scale,
    rotation_y: input.rotationY,
    height_offset: input.heightOffset,
    validation_status: "approved",
    content_type: validated.contentType,
    body_bytes: validated.bodyBytes,
    triangle_count: validated.triangleCount,
    texture_count: validated.textureCount,
    animation_count: validated.animationCount,
    validation_note: validationNote,
    validated_at: new Date().toISOString(),
  }, { onConflict: "bitmap_height" }).select().single();
  if (error) throw error;
  return data;
}

export async function removeBitmapModel(userId: string, height: number) {
  await liveOwner(userId, height);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("bitmap_models").delete().eq("bitmap_height", height);
  if (error) throw error;
  return { ok: true };
}