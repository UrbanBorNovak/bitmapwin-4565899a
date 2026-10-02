import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, RankShell, RankTable, Td, Th, type Scope } from "@/components/ranks/RankShell";

export const Route = createFileRoute("/ranks/walkers")({
  head: () => {
    const title = "Iron Walker Raid Ranks — The Oasis — BitmapWin";
    const description =
      "Who lands the killing blow? Players join forces against giant voxel Iron Walkers in The Oasis — ranked by kills and damage.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: WalkerBoard,
});

type Row = { user_id: string; name: string; kills: number; damage: number; updated_at: string };

function WalkerBoard() {
  const [scope, setScope] = useState<Scope>("all");
  const [term, setTerm] = useState("");
  const scores = useQuery({
    queryKey: ["walker-raid-scores"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("walker_raid_scores")
        .select("user_id, name, kills, damage, updated_at")
        .order("kills", { ascending: false })
        .order("damage", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 15_000,
  });
  const rows = useMemo(() => {
    const week = Date.now() - 7 * 86_400_000;
    const q = term.trim().toLowerCase();
    return (scores.data ?? []).filter(
      (r) => (scope === "all" || Date.parse(r.updated_at) >= week) && (!q || r.name.toLowerCase().includes(q)),
    );
  }, [scores.data, scope, term]);

  return (
    <RankShell
      scope={scope}
      onScope={setScope}
      term={term}
      onTerm={setTerm}
      lore="TWO IRON WALKERS STALK THE FIRST BITMAPS. THEIR ARMOUR IS SHARED BY EVERY HUNTER — STRIKE TOGETHER, AND THE KILLING BLOW TAKES THE KILL."
    >
      {rows.length === 0 ? (
        <EmptyState note={scores.isLoading ? "LOADING RAID BOARD…" : "NO IRON WALKER HAS FALLEN — YET"} />
      ) : (
        <RankTable compact head={<><Th>#</Th><Th>HUNTER</Th><Th right>KILLS</Th><Th right>DAMAGE</Th></>}>
          {rows.map((r, i) => (
            <tr key={r.user_id}>
              <Td>{i + 1}</Td>
              <Td><span className="font-bold text-foreground">{r.name}</span></Td>
              <Td right><span className="text-bitcoin">{r.kills}</span></Td>
              <Td right>{Number(r.damage).toLocaleString("en-US")}</Td>
            </tr>
          ))}
        </RankTable>
      )}
    </RankShell>
  );
}
