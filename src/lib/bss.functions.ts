import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/** Public read of a BITMAP's on-chain BSS scene. */
export const getBssScene = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { bssSceneForHeight } = await import("@/lib/bss.server");
    return bssSceneForHeight(data.height);
  });

/** Decodes a specific BSS BMP inscription. */
export const getBssSceneByInscription = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ inscriptionId: z.string().trim().regex(/^[0-9a-fA-F]{64}i\d+$/) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { bssSceneFromInscription } = await import("@/lib/bss.server");
    return bssSceneFromInscription(data.inscriptionId);
  });

/** Public directory of verified BSS scenes inside one atlas district. */
export const getBssScenesInRange = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({
      lo: z.number().int().min(0).max(1_048_575),
      hi: z.number().int().min(0).max(1_048_575),
    }).refine(({ lo, hi }) => lo <= hi, "Invalid block range").parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data: scenes, error } = await client
      .from("bitmap_bss_scenes")
      .select("bitmap_height, bmp_inscription_id, version_label, object_count, resource_count, verified_at")
      .eq("is_valid", true)
      .gte("bitmap_height", data.lo)
      .lte("bitmap_height", data.hi)
      .order("bitmap_height", { ascending: true })
      .limit(128);
    if (error) return { scenes: [] };
    return { scenes: scenes ?? [] };
  });
