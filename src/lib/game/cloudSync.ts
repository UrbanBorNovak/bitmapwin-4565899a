import { supabase } from "@/integrations/supabase/client";
import { normalizeVisualSettings } from "./pfpExtenders";
import { normalizePlayProfile } from "./persistence";
import type { PlayProfile } from "./types";

/**
 * Cloud sync for PLAY progress. Local storage stays the instant cache; the
 * database is the cross-device source of truth for wallet-owned profiles.
 * Every call fails soft — the game never blocks on the network.
 */

function score(p: PlayProfile) {
  return (p.stats?.matches ?? 0) * 1000 + (p.events?.length ?? 0) + Object.keys(p.cards ?? {}).length / 1000;
}

function sanitize(raw: unknown, owner: string): PlayProfile | null {
  const p = raw as PlayProfile | null;
  if (!p || p.version !== 1 || typeof p.cards !== "object" || !Array.isArray(p.order)) return null;
  return normalizePlayProfile({ ...p, owner, visuals: normalizeVisualSettings(p.visuals) });
}

export async function fetchRemotePlayProfile(owner: string): Promise<PlayProfile | null> {
  if (owner === "guest") return null;
  try {
    const { data } = await supabase.from("play_profiles").select("profile").eq("wallet_address", owner).maybeSingle();
    return data ? sanitize(data.profile, owner) : null;
  } catch {
    return null;
  }
}

/** Pick whichever copy carries more play history. */
export function pickRicher(local: PlayProfile | null, remote: PlayProfile | null): PlayProfile | null {
  if (!local) return remote;
  if (!remote) return local;
  return score(remote) > score(local) ? remote : local;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function queueRemoteSave(profile: PlayProfile) {
  if (profile.owner === "guest" || typeof window === "undefined") return;
  const prev = timers.get(profile.owner);
  if (prev) clearTimeout(prev);
  timers.set(
    profile.owner,
    setTimeout(() => {
      timers.delete(profile.owner);
      void pushRemote(profile);
    }, 1200),
  );
}

async function pushRemote(profile: PlayProfile) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("play_profiles").upsert(
      {
        wallet_address: profile.owner,
        user_id: data.user.id,
        profile: JSON.parse(JSON.stringify(profile)),
        matches: profile.stats.matches,
        wins: profile.stats.wins,
        losses: profile.stats.losses,
        best_streak: profile.stats.bestStreak,
      },
      { onConflict: "wallet_address" },
    );
  } catch {
    /* offline or wallet not verified — local copy remains */
  }
}
