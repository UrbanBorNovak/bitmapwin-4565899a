// Account copy of the Toon Studio library (one row per user, RLS: own row only).
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { emptyLibrary, type ToonLibrary } from "./toon-library";

export async function fetchCloudLibrary(userId: string): Promise<ToonLibrary | null> {
  const { data, error } = await supabase.from("toon_libraries").select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const v = data?.data as unknown as ToonLibrary | undefined;
  if (!v) return null;
  return Array.isArray(v.series) && Array.isArray(v.casts) ? v : emptyLibrary();
}

export async function pushCloudLibrary(userId: string, lib: ToonLibrary): Promise<void> {
  const { error } = await supabase
    .from("toon_libraries")
    .upsert({ user_id: userId, data: lib as unknown as Json, updated_at: new Date().toISOString() });
  if (error) throw error;
}
