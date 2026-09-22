/**
 * LAND SKINS — an image reinscribed onto a BITMAP, painted over its land.
 *
 * A BITMAP claim lives on one sat. Anything inscribed later on that same sat is
 * a reinscription. When the newest reinscription is an image, the owner has in
 * effect painted their land, so the world shows it flat on the ground where you
 * can walk across it. Nothing is invented: if no image reinscription exists,
 * the land stays bare.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { scanReinscriptions } from "@/lib/parcels.server";

export type LandSkin = {
  height: number;
  /** The image reinscription painted on this land. */
  inscriptionId: string;
  contentType: string;
  /** The BITMAP claim inscription the image rides on. */
  bitmapInscriptionId: string;
};

/** Resolved answers, including "nothing here", so ord is asked once per hour. */
const cache = new Map<number, { at: number; skin: LandSkin | null }>();
const TTL = 60 * 60 * 1000;
/** In-flight lookups, so a crowd of tiles never stacks the same request. */
const inflight = new Map<number, Promise<LandSkin | null>>();

function db() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function bitmapInscriptionFor(height: number): Promise<string | null> {
  const indexed = await db()
    .from("inscriptions")
    .select("id")
    .eq("bitmap_height", height)
    .eq("is_bitmap_claim", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (indexed.data?.id) return indexed.data.id;
  try {
    const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
    return (await locateBitmapHolder(height)).inscriptionId;
  } catch {
    return null;
  }
}

const isImage = (type: string | null) => {
  const t = (type ?? "").toLowerCase();
  return t.startsWith("image/") || t.startsWith("image ");
};

async function resolve(height: number): Promise<LandSkin | null> {
  const bitmapInscriptionId = await bitmapInscriptionFor(height);
  if (!bitmapInscriptionId) return null;
  const scan = await scanReinscriptions(bitmapInscriptionId);
  // The newest image wins: repainting the land is just another reinscription.
  const images = scan.reinscriptions.filter((r) => isImage(r.contentType));
  const newest = images[images.length - 1];
  if (!newest) return null;
  return {
    height,
    inscriptionId: newest.inscriptionId,
    contentType: newest.contentType ?? "image/*",
    bitmapInscriptionId,
  };
}

/** How long a remembered answer stands before ord is asked again. */
const REMEMBERED = 7 * 24 * 60 * 60 * 1000;

async function remember(height: number, skin: LandSkin | null) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bitmap_land_skins").upsert(
      {
        bitmap_height: height,
        bitmap_inscription_id: skin?.bitmapInscriptionId ?? null,
        image_inscription_id: skin?.inscriptionId ?? null,
        content_type: skin?.contentType ?? null,
        has_image: Boolean(skin),
        checked_at: new Date().toISOString(),
      },
      { onConflict: "bitmap_height" },
    );
  } catch {
    // Remembering is a convenience; the lookup still stands on its own.
  }
}

/** The image painted on one BITMAP's land, or null when the land is bare. */
export async function landSkinFor(height: number): Promise<LandSkin | null> {
  const hit = cache.get(height);
  if (hit && Date.now() - hit.at < TTL) return hit.skin;
  const running = inflight.get(height);
  if (running) return running;

  const task = (async (): Promise<LandSkin | null> => {
    const row = await db()
      .from("bitmap_land_skins")
      .select("bitmap_inscription_id, image_inscription_id, content_type, has_image, checked_at")
      .eq("bitmap_height", height)
      .maybeSingle();
    const known = row.data;
    if (known && Date.now() - new Date(known.checked_at).getTime() < REMEMBERED) {
      if (!known.has_image || !known.image_inscription_id) return null;
      return {
        height,
        inscriptionId: known.image_inscription_id,
        contentType: known.content_type ?? "image/*",
        bitmapInscriptionId: known.bitmap_inscription_id ?? "",
      };
    }
    const fresh = await resolve(height).catch(() => null);
    await remember(height, fresh);
    return fresh;
  })()
    .catch(() => null)
    .then((skin) => {
      cache.set(height, { at: Date.now(), skin });
      inflight.delete(height);
      return skin;
    });
  inflight.set(height, task);
  return task;
}


/** Reads a handful of neighbouring tiles at once for the walkable world. */
export async function landSkinsFor(heights: number[]): Promise<LandSkin[]> {
  const unique = Array.from(new Set(heights.filter((h) => Number.isFinite(h) && h >= 0))).slice(0, 12);
  const found = await Promise.all(unique.map((height) => landSkinFor(height)));
  return found.filter((skin): skin is LandSkin => Boolean(skin));
}
