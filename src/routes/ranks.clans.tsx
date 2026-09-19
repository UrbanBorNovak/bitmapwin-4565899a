import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EmptyState, RankShell, RankTable, Td, Th, type Scope } from "@/components/ranks/RankShell";
import { clanScore, medal, rankClansQuery, rankPlayersQuery } from "@/lib/ranks";

export const Route = createFileRoute("/ranks/clans")({
  head: () => {
    const title = "Clan Ranks — The Oasis — BitmapWin";
    const description =
      "Clan standings in The Oasis: tags, crests, mottos, fame, player kills and the bitmaps each clan calls home.";
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
  component: ClanBoard,
});

function ClanBoard() {
  const [scope, setScope] = useState<Scope>("all");
  const [term, setTerm] = useState("");
  const clans = useQuery(rankClansQuery());
  const players = useQuery(rankPlayersQuery());

  const leaderName = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of players.data ?? []) map.set(player.id, player.name);
    return map;
  }, [players.data]);

  const rows = useMemo(() => {
    const query = term.trim().toLowerCase().replace(/[[\]]/g, "");
    return (clans.data ?? [])
      .filter((clan) =>
        query ? clan.tag.toLowerCase().includes(query) || clan.name.toLowerCase().includes(query) : true,
      )
      .sort((a, b) => clanScore(b) - clanScore(a));
  }, [clans.data, term]);

  return (
    <RankShell
      scope={scope}
      onScope={setScope}
      term={term}
      onTerm={setTerm}
      lore="Banners of The Oasis. Clan score counts fame, sworn members and the land the banner holds. Clan wars come later — for now the blood on the roster speaks."
    >
      {clans.isLoading ? (
        <p className="label">RAISING THE BANNERS…</p>
      ) : rows.length === 0 ? (
        <EmptyState note="NO BANNERS HAVE BEEN RAISED IN THE OASIS — YET" />
      ) : (
        <RankTable
          head={
            <>
              <Th>#</Th>
              <Th>[TAG] NAME</Th>
              <Th>LEADER</Th>
              <Th right>MEMBERS</Th>
              <Th right>FAME</Th>
              <Th right>PKS</Th>
              <Th>HOME BITMAP</Th>
              <Th>MOTTO</Th>
            </>
          }
        >
          {rows.map((clan, index) => (
            <tr key={clan.id}>
              <Td right>{`${medal(index)} ${index + 1}`}</Td>
              <Td>
                <Link to="/clan/$tag" params={{ tag: clan.tag }} className="flex items-center gap-2 hover:underline">
                  <span
                    aria-hidden="true"
                    className="inline-block size-3 border border-border"
                    style={{ background: clan.crestColor }}
                  />
                  <span className="text-bitcoin">[{clan.tag}]</span>
                  <span className="font-bold text-foreground">{clan.name}</span>
                </Link>
              </Td>
              <Td>{(clan.leaderId ? leaderName.get(clan.leaderId) : null)?.toUpperCase() ?? "—"}</Td>
              <Td right>{clan.membersCount}</Td>
              <Td right>{clan.fame.toLocaleString()}</Td>
              <Td right>{clan.pkKills}</Td>
              <Td>
                {clan.homeBitmap === null ? (
                  "—"
                ) : (
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(clan.homeBitmap) }}
                    className="text-signal hover:underline"
                  >
                    {clan.homeBitmap}.BITMAP
                  </Link>
                )}
              </Td>
              <Td>
                <span className="text-muted-foreground">{clan.motto || "—"}</span>
              </Td>
            </tr>
          ))}
        </RankTable>
      )}
    </RankShell>
  );
}
