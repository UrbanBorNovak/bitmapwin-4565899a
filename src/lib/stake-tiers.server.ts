/** Reads every tier proof from chain-backed sources. Any proof that can't be read counts as not proven. */
import type { TierProofs } from "@/lib/stake-tiers";
import { isMilestoneBlock } from "@/lib/stake-tiers";

const ORD = "https://ordinals.com";
async function ord(path: string): Promise<Response | null> {
  try {
    const r = await fetch(`${ORD}${path}`, { headers: { accept: "application/json, */*" }, signal: AbortSignal.timeout(10_000) });
    return r.ok ? r : null;
  } catch { return null; }
}

/** A grade reinscribed on the BITMAP's own sat: a lean grade delegating to the slab master, or a standalone BW-SLAB-1 card. */
async function slabOnSat(height: number): Promise<boolean> {
  const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
  const { SLAB_MASTER_DELEGATE_ID } = await import("@/lib/slab-master-delegate");
  const parent = (await locateBitmapHolder(height)).inscriptionId;
  if (!parent) return false;
  const meta = await ord(`/r/inscription/${parent}`);
  const sat = meta ? ((await meta.json().catch(() => null)) as { sat?: number | string | null } | null)?.sat : null;
  if (sat == null) return false;
  const list = await ord(`/r/sat/${sat}`);
  const ids = ((list ? ((await list.json().catch(() => null)) as { ids?: string[] } | null) : null)?.ids ?? []).filter((id) => id !== parent).reverse().slice(0, 10);
  for (const id of ids) {
    const info = await ord(`/r/inscription/${id}`);
    const j = info ? ((await info.json().catch(() => null)) as { delegate?: string | null; content_type?: string | null; content_length?: number | null } | null) : null;
    if (SLAB_MASTER_DELEGATE_ID && j?.delegate === SLAB_MASTER_DELEGATE_ID) return true;
    if (j?.content_type?.includes("html") && (j.content_length ?? 0) <= 200_000) {
      const c = await ord(`/content/${id}`);
      if (c && (await c.text()).includes("BW-SLAB-1") ) return true;
    }
  }
  return false;
}

export async function readTierProofs(height: number): Promise<TierProofs> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const safe = async (f: () => Promise<boolean>) => { try { return await f(); } catch (e) { console.error("stake tier proof", e); return false; } };
  const [patoshi, guardian, slab, forge] = await Promise.all([
    safe(async () => !!(await db.from("patoshi_blocks").select("block_height").eq("block_height", height).maybeSingle()).data),
    safe(async () => {
      const { data } = await db.from("bitmon_guardians").select("stats").eq("block_height", height).maybeSingle();
      return typeof (data?.stats as { inscription?: unknown } | null)?.inscription === "string";
    }),
    safe(() => slabOnSat(height)),
    safe(async () => {
      const { forgeBuildForHeight } = await import("@/lib/forge.server");
      if (await forgeBuildForHeight(height)) return true;
      // the chain-verified build directory (a reinscription stays on the sat through every sale)
      return !!(await db.from("bitmap_forge_builds").select("bitmap_height").eq("bitmap_height", height).maybeSingle()).data;
    }),
  ]);
  return { patoshi, milestone: isMilestoneBlock(height), guardian, slab, forge };
}
