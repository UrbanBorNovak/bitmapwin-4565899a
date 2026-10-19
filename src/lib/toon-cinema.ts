// Toon Cinema submissions: creators submit, an admin approves, approved episodes play on /watch.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { parseEpisode, type ToonEpisode } from "./toon-script";

export type SubmissionStatus = "pending" | "approved" | "rejected";
export interface Submission {
  id: string; title: string; creator_name: string | null; episode: ToonEpisode;
  status: SubmissionStatus; review_note: string | null; created_at: string; reviewed_at: string | null;
}
const COLS = "id, title, creator_name, episode, status, review_note, created_at, reviewed_at";

export async function submitEpisode(userId: string, episode: ToonEpisode, creatorName: string | null) {
  const clean = parseEpisode(JSON.stringify(episode));
  const title = (clean.title || "Untitled episode").slice(0, 120);
  const { error } = await supabase.from("toon_submissions").insert({
    user_id: userId, title, creator_name: creatorName?.trim().slice(0, 48) || null, episode: clean as unknown as Json,
  });
  if (error) throw error;
}

export async function mySubmissions(userId: string): Promise<Submission[]> {
  const { data, error } = await supabase.from("toon_submissions").select(COLS).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Submission[];
}

export async function withdrawSubmission(id: string) {
  const { error } = await supabase.from("toon_submissions").delete().eq("id", id);
  if (error) throw error;
}

export async function isCinemaAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

export async function reviewQueue(status: SubmissionStatus): Promise<Submission[]> {
  const { data, error } = await supabase.from("toon_submissions").select(COLS).eq("status", status).order("created_at", { ascending: status === "pending" }).limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as Submission[];
}

export async function reviewSubmission(id: string, status: SubmissionStatus, note: string | null) {
  const { error } = await supabase.from("toon_submissions").update({ status, review_note: note || null }).eq("id", id);
  if (error) throw error;
}
