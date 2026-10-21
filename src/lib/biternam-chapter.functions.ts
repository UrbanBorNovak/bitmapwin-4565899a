import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QUOTE_MAX, TITLE_MAX, cleanText } from "@/lib/biternam-chapter";

export type CommunityChapter = { height: number; title: string; quote: string; owner: string; updatedAt: string };

/** Public: the block's tx count from stored block_stats (null when not recorded — never guessed). */
export const blockFactsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("block_stats").select("tx_count").eq("block_height", data.height).maybeSingle();
    return { height: data.height, txCount: row ? Number(row.tx_count) : null };
  });

/** Public: published community chapters with tx counts, newest first. No account columns. */
export const listChaptersFn = createServerFn({ method: "GET" }).handler(async (): Promise<(CommunityChapter & { txCount: number | null })[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin.from as unknown as (t: string) => any)("biternam_chapters")
    .select("block_height,title,quote,owner_address,updated_at").order("updated_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as { block_height: number; title: string; quote: string; owner_address: string; updated_at: string }[];
  const heights = rows.map((r) => r.block_height);
  const tx = new Map<number, number>();
  if (heights.length) {
    const { data: s } = await supabaseAdmin.from("block_stats").select("block_height,tx_count").in("block_height", heights);
    for (const r of s ?? []) tx.set(Number(r.block_height), Number(r.tx_count));
  }
  return rows.map((r) => ({ height: r.block_height, title: r.title, quote: r.quote, owner: r.owner_address, updatedAt: r.updated_at, txCount: tx.get(r.block_height) ?? null }));
});

/** Free publish: only a signed-in account whose verified linked wallet holds the BITMAP right now. */
export const publishChapterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000), title: z.string().max(200), quote: z.string().max(400) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: string }> => {
    const title = cleanText(data.title, TITLE_MAX), quote = cleanText(data.quote, QUOTE_MAX);
    if (title.length < 3 || quote.length < 3) return { ok: false, reason: "TITLE AND QUOTE NEED AT LEAST 3 CHARACTERS" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { locateBitmap } = await import("@/lib/locate-bitmap.server");
    const { data: links } = await supabaseAdmin.from("wallet_links").select("address").eq("user_id", context.userId);
    if (!links?.length) return { ok: false, reason: "LINK YOUR WALLET IN PASSPORT FIRST" };
    let owner: string | null = null;
    for (const { address } of links) {
      try { if ((await locateBitmap({ height: data.height, address })).heldByAddress) { owner = address; break; } } catch { /* try next */ }
    }
    if (!owner) return { ok: false, reason: "ONLY THE LIVE HOLDER OF THIS BITMAP CAN PUBLISH ITS CHAPTER" };
    const { error } = await (supabaseAdmin.from as unknown as (t: string) => any)("biternam_chapters").upsert({
      block_height: data.height, title, quote, owner_address: owner, set_by: context.userId, updated_at: new Date().toISOString(),
    });
    return error ? { ok: false, reason: "SAVE FAILED" } : { ok: true };
  });
