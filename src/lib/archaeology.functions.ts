import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { officialTrait } from "@/lib/traits";

const nominationInput = z.object({
  traitId: z.string().trim().min(1).max(80),
  bitmapHeight: z.number().int().nonnegative().max(2_100_000),
  thesis: z.string().trim().min(30).max(1200),
  evidenceUrl: z.string().trim().url().max(500).refine((value) => value.startsWith("https://"), "Evidence must use HTTPS"),
  contributorName: z.string().trim().min(2).max(40),
});

export const nominateBitmapArchaeologyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => nominationInput.parse(data))
  .handler(async ({ data, context }) => {
    const trait = officialTrait(data.traitId);
    if (!trait) throw new Error("UNKNOWN OFFICIAL TRAIT");

    const indexed = await context.supabase
      .from("bitmap_index")
      .select("inscription_id, is_valid")
      .eq("block_height", data.bitmapHeight)
      .eq("is_valid", true)
      .maybeSingle();
    if (indexed.error) throw new Error("BITMAP INDEX UNAVAILABLE");
    if (!indexed.data?.inscription_id) throw new Error("NO VALID INDEXED BITMAP FOUND AT THIS HEIGHT");

    const write = await context.supabase.from("bitmap_archaeology_nominations").insert({
      user_id: context.userId,
      trait_id: trait.id,
      bitmap_height: data.bitmapHeight,
      inscription_id: indexed.data.inscription_id,
      thesis: data.thesis,
      evidence_url: data.evidenceUrl,
      contributor_name: data.contributorName,
      status: "pending",
    }).select("id, status").single();

    if (write.error) {
      if (write.error.code === "23505") throw new Error("YOU ALREADY NOMINATED THIS BITMAP FOR THIS TRAIT");
      throw new Error(write.error.message);
    }
    return write.data;
  });