/**
 * RANKS — the old-school hall of fame for The Oasis.
 *
 * Boards are public: they read straight from the ranking tables with the
 * browser client under public read policies. Scores are computed here so the
 * same rules drive tables, profiles and clan pages.
 */

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RankStatus = "peaceful" | "flagged" | "chaotic" | "hero";
export type ClanRank = "leader" | "knight" | "member" | "academy";

export type RankClan = {
  id: string;
  tag: string;
  name: string;
  crestColor: string;
  motto: string;
  leaderId: string | null;
  level: number;
  xp: number;
  fame: number;
  pkKills: number;
  membersCount: number;
  homeBitmap: number | null;
  createdAt: string;
};

export type RankPlayer = {
  id: string;
  wallet: string | null;
  name: string;
  title: string;
  level: number;
  fame: number;
  karma: number;
  pkKills: number;
  pvpKills: number;
  deaths: number;
  chaoticCount: number;
  status: RankStatus;
  clanId: string | null;
  clanTag: string | null;
  clanName: string | null;
  crestColor: string | null;
  homeBitmap: number | null;
  lastDistrict: string | null;
  lastKillAt: string | null;
  lastDeathAt: string | null;
  bitEarned: number;
  districtsVisited: number;
  buildsMaintained: number;
  createdAt: string;
};

export type PvpEvent = {
  id: string;
  killerId: string | null;
  victimId: string | null;
  killerName: string | null;
  victimName: string | null;
  district: string | null;
  bitmap: number | null;
  karmaDelta: number;
  wasPk: boolean;
  createdAt: string;
};

/* ------------------------------------------------------------------ rules */

export function titleForLevel(level: number): string {
  if (level >= 70) return "King";
  if (level >= 60) return "Duke";
  if (level >= 50) return "Count";
  if (level >= 40) return "Baron";
  if (level >= 30) return "Knight";
  if (level >= 20) return "Warden";
  if (level >= 10) return "Scout";
  return "Novice";
}

export function statusFor(karma: number, fame: number): RankStatus {
  if (karma <= -100) return "chaotic";
  if (karma < 0) return "flagged";
  if (fame >= 1000) return "hero";
  return "peaceful";
}

/** Name colour class per karma band — red outlaws, gold heroes. */
export function statusClass(status: RankStatus): string {
  if (status === "chaotic") return "text-red-500";
  if (status === "flagged") return "text-bitcoin";
  if (status === "hero") return "text-yellow-300";
  return "text-foreground";
}

export function progressionScore(p: RankPlayer): number {
  return (
    p.level * 1000 +
    p.fame +
    p.districtsVisited * 5 +
    p.buildsMaintained * 20 +
    Math.floor(p.bitEarned / 10)
  );
}

export function pvpScore(p: RankPlayer): number {
  return p.pvpKills * 3 + p.pkKills - p.deaths + Math.max(p.karma, 0) / 10;
}

/**
 * Clan progression tiers. Clans gain points when souls join the banner
 * (+250 each) and carry their fame and blood into the total.
 */
export const CLAN_TIERS = [
  { name: "Banner", xp: 0 },
  { name: "Pledge", xp: 500 },
  { name: "Order", xp: 1500 },
  { name: "Chapter", xp: 4000 },
  { name: "House", xp: 9000 },
  { name: "Legion", xp: 20000 },
  { name: "Dynasty", xp: 45000 },
] as const;

export const CLAN_JOIN_XP = 250;

/**
 * Hardcoded clan crests. Tags are uppercase; the crest image is the
 * inscribed banner carried by that clan everywhere a crest is drawn.
 */
export const CLAN_CREST_IMAGES: Readonly<Record<string, string>> = {
  JGH: "https://ordinals.com/content/f537200970e9592b572e1ae0fe60d2d326ecffe79b1d5e44b494917c57044a13i0",
};

export function clanCrestImage(tag: string | null | undefined): string | null {
  if (!tag) return null;
  return CLAN_CREST_IMAGES[tag.toUpperCase()] ?? null;
}

export function clanTierIndex(xp: number): number {
  let index = 0;
  for (let i = 0; i < CLAN_TIERS.length; i += 1) {
    if (xp >= CLAN_TIERS[i]!.xp) index = i;
  }
  return index;
}

export function clanTier(xp: number): { name: string; level: number; xp: number } {
  const index = clanTierIndex(xp);
  const tier = CLAN_TIERS[index]!;
  return { name: tier.name, level: index + 1, xp: tier.xp };
}

/** Points still needed for the next tier, and how far through it the clan is. */
export function clanTierProgress(xp: number): { next: string | null; needed: number; ratio: number } {
  const index = clanTierIndex(xp);
  const floor = CLAN_TIERS[index]!.xp;
  const next = CLAN_TIERS[index + 1];
  if (!next) return { next: null, needed: 0, ratio: 1 };
  const span = next.xp - floor;
  return {
    next: next.name,
    needed: next.xp - xp,
    ratio: span > 0 ? Math.min(1, Math.max(0, (xp - floor) / span)) : 1,
  };
}

export function clanScore(c: RankClan): number {
  return c.fame + c.membersCount * 50 + (c.homeBitmap ? 100 : 0);
}

export function kd(p: RankPlayer): string {
  const kills = p.pvpKills + p.pkKills;
  if (p.deaths === 0) return kills ? `${kills}.00` : "0.00";
  return (kills / p.deaths).toFixed(2);
}

export const MEDALS = ["🥇", "🥈", "🥉"] as const;

export function medal(index: number): string {
  return MEDALS[index] ?? "";
}

export function sinceLabel(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "NOW";
  if (minutes < 60) return `${minutes}M AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  return `${Math.round(hours / 24)}D AGO`;
}

export function isRecent(iso: string | null, days = 7): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < days * 86_400_000;
}

/* ------------------------------------------------------------------- data */

type PlayerRow = {
  id: string;
  wallet: string | null;
  name: string;
  title: string;
  level: number;
  fame: number;
  karma: number;
  pk_kills: number;
  pvp_kills: number;
  deaths: number;
  chaotic_count: number;
  status: string;
  clan_id: string | null;
  home_bitmap: number | null;
  last_district: string | null;
  last_kill_at: string | null;
  last_death_at: string | null;
  bit_earned: number;
  districts_visited: number;
  builds_maintained: number;
  created_at: string;
  rank_clans?: { tag: string; name: string; crest_color: string } | null;
};

const PLAYER_SELECT = "*, rank_clans(tag, name, crest_color)";

function toPlayer(row: PlayerRow): RankPlayer {
  return {
    id: row.id,
    wallet: row.wallet,
    name: row.name,
    title: row.title || titleForLevel(row.level),
    level: row.level,
    fame: Number(row.fame),
    karma: row.karma,
    pkKills: row.pk_kills,
    pvpKills: row.pvp_kills,
    deaths: row.deaths,
    chaoticCount: row.chaotic_count,
    status: (row.status as RankStatus) ?? statusFor(row.karma, Number(row.fame)),
    clanId: row.clan_id,
    clanTag: row.rank_clans?.tag ?? null,
    clanName: row.rank_clans?.name ?? null,
    crestColor: row.rank_clans?.crest_color ?? null,
    homeBitmap: row.home_bitmap === null ? null : Number(row.home_bitmap),
    lastDistrict: row.last_district,
    lastKillAt: row.last_kill_at,
    lastDeathAt: row.last_death_at,
    bitEarned: Number(row.bit_earned),
    districtsVisited: row.districts_visited,
    buildsMaintained: row.builds_maintained,
    createdAt: row.created_at,
  };
}

type ClanRow = {
  id: string;
  tag: string;
  name: string;
  crest_color: string;
  motto: string;
  leader_id: string | null;
  level: number;
  xp: number;
  fame: number;
  pk_kills: number;
  members_count: number;
  home_bitmap: number | null;
  created_at: string;
};

function toClan(row: ClanRow): RankClan {
  return {
    id: row.id,
    tag: row.tag,
    name: row.name,
    crestColor: row.crest_color,
    motto: row.motto,
    leaderId: row.leader_id,
    level: clanTierIndex(Number(row.xp ?? 0)) + 1,
    xp: Number(row.xp ?? 0),
    fame: Number(row.fame),
    pkKills: row.pk_kills,
    membersCount: row.members_count,
    homeBitmap: row.home_bitmap === null ? null : Number(row.home_bitmap),
    createdAt: row.created_at,
  };
}

type EventRow = {
  id: string;
  killer_id: string | null;
  victim_id: string | null;
  district: string | null;
  bitmap: number | null;
  karma_delta: number;
  was_pk: boolean;
  created_at: string;
  killer?: { name: string } | null;
  victim?: { name: string } | null;
};

const EVENT_SELECT =
  "id, killer_id, victim_id, district, bitmap, karma_delta, was_pk, created_at, killer:killer_id(name), victim:victim_id(name)";

function toEvent(row: EventRow): PvpEvent {
  return {
    id: row.id,
    killerId: row.killer_id,
    victimId: row.victim_id,
    killerName: row.killer?.name ?? null,
    victimName: row.victim?.name ?? null,
    district: row.district,
    bitmap: row.bitmap === null ? null : Number(row.bitmap),
    karmaDelta: row.karma_delta,
    wasPk: row.was_pk,
    createdAt: row.created_at,
  };
}

export const rankPlayersQuery = () =>
  queryOptions<RankPlayer[]>({
    queryKey: ["rank-players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rank_players")
        .select(PLAYER_SELECT)
        .order("fame", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as PlayerRow[]).map(toPlayer);
    },
    staleTime: 30_000,
  });

export const rankClansQuery = () =>
  queryOptions<RankClan[]>({
    queryKey: ["rank-clans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rank_clans")
        .select("*")
        .order("fame", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as ClanRow[]).map(toClan);
    },
    staleTime: 30_000,
  });

export const pvpFeedQuery = (limit = 40) =>
  queryOptions<PvpEvent[]>({
    queryKey: ["pvp-feed", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pvp_events")
        .select(EVENT_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as EventRow[]).map(toEvent);
    },
    staleTime: 15_000,
  });

export const playerEventsQuery = (playerId: string) =>
  queryOptions<PvpEvent[]>({
    queryKey: ["pvp-feed-player", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pvp_events")
        .select(EVENT_SELECT)
        .or(`killer_id.eq.${playerId},victim_id.eq.${playerId}`)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as EventRow[]).map(toEvent);
    },
    staleTime: 15_000,
  });

export const clanRosterQuery = (clanId: string | null) =>
  queryOptions<{ playerId: string; rank: ClanRank }[]>({
    queryKey: ["rank-clan-roster", clanId],
    enabled: Boolean(clanId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rank_clan_members")
        .select("player_id, rank")
        .eq("clan_id", clanId ?? "");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        playerId: row.player_id as string,
        rank: row.rank as ClanRank,
      }));
    },
    staleTime: 30_000,
  });

/* ------------------------------------------- outlaw lookup for world HUD */

let chaoticNames: Set<string> | null = null;
let chaoticLoading: Promise<void> | null = null;

/** Lowercase names of everybody flagged chaotic, cached for the whole session. */
export function chaoticHandles(): Set<string> {
  if (!chaoticNames && !chaoticLoading && typeof window !== "undefined") {
    chaoticLoading = (async () => {
      try {
        const { data } = await supabase.from("rank_players").select("name").eq("status", "chaotic");
        chaoticNames = new Set((data ?? []).map((row) => String(row.name).toLowerCase()));
      } catch {
        chaoticNames = new Set();
      }
    })();
  }
  return chaoticNames ?? new Set();
}

export function isChaoticHandle(handle: string): boolean {
  return chaoticHandles().has(handle.trim().toLowerCase());
}
