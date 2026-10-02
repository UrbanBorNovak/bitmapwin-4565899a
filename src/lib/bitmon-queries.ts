import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchBlockDnaSource, guardianFromBlock, type GuardianRarity, type GuardianSpecies } from "@/lib/bitmon";

export type AwakeGuardian = {
  height: number;
  species: GuardianSpecies;
  rarity: GuardianRarity;
  hp: number;
  bite: number;
  speed: number;
  armor: number;
  ability: string;
  body: string;
  accent: string;
  level: number;
  owner: string;
  txid: string;
  createdAt: string;
};

type Row = {
  block_height: number;
  species: string;
  rarity: string;
  stats: Record<string, unknown>;
  summoned_by_address: string;
  payment_txid: string;
  created_at: string;
};

function toGuardian(r: Row): AwakeGuardian {
  const s = r.stats ?? {};
  return {
    height: Number(r.block_height),
    species: r.species as GuardianSpecies,
    rarity: r.rarity as GuardianRarity,
    hp: Number(s["hp"] ?? 0),
    bite: Number(s["bite"] ?? 0),
    speed: Number(s["speed"] ?? 0),
    armor: Number(s["armor"] ?? 0),
    ability: String(s["ability"] ?? ""),
    body: String(s["body"] ?? "#8b8780"),
    accent: String(s["accent"] ?? "#f7931a"),
    level: Number(s["level"] ?? 1),
    owner: r.summoned_by_address,
    txid: r.payment_txid,
    createdAt: r.created_at,
  };
}

const COLS = "block_height, species, rarity, stats, summoned_by_address, payment_txid, created_at";

export const guardianQuery = (height: number) =>
  queryOptions({
    queryKey: ["guardian", height],
    queryFn: async () => {
      const { data } = await supabase.from("bitmon_guardians").select(COLS).eq("block_height", height).maybeSingle();
      return data ? toGuardian(data as Row) : null;
    },
    staleTime: 30_000,
  });

export const allGuardiansQuery = () =>
  queryOptions({
    queryKey: ["guardians", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("bitmon_guardians").select(COLS).order("created_at", { ascending: false }).limit(500);
      return (data ?? []).map((r) => toGuardian(r as Row));
    },
    staleTime: 30_000,
    // An open Oasis picks up Guardians awakened anywhere (other tabs, other players).
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

export const guardianDnaQuery = (height: number) =>
  queryOptions({
    queryKey: ["guardian-dna", height],
    queryFn: async () => guardianFromBlock(await fetchBlockDnaSource(height)),
    staleTime: Infinity,
    retry: 1,
  });
