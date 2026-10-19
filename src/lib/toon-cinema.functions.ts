import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ApprovedEpisode { id: string; title: string; creator_name: string | null; episode: unknown; reviewed_at: string | null }

/** Approved cinema episodes, read as the public (anon) role so no account data is exposed. */
export const listApprovedEpisodes = createServerFn({ method: "GET" }).handler(async (): Promise<ApprovedEpisode[]> => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const db = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
  const { data, error } = await db.from("toon_submissions").select("id, title, creator_name, episode, reviewed_at")
    .eq("status", "approved").order("reviewed_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as ApprovedEpisode[];
});
