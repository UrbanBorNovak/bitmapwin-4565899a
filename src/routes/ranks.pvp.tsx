import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  EmptyState,
  PlayerCell,
  RankShell,
  RankTable,
  StatusPill,
  Td,
  Th,
  useMyPlayer,
  type Scope,
} from "@/components/ranks/RankShell";
import { isRecent, kd, medal, pvpScore, rankPlayersQuery, sinceLabel, type RankPlayer } from "@/lib/ranks";

export const Route = createFileRoute("/ranks/pvp")({
  head: () => {
    const title = "PvP & PK Ranks — The Oasis — BitmapWin";
    const description =
      "Kills, player kills, deaths and karma in The Oasis. Red names are chaotic outlaws hunted across Bitcoin land.";
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
  component: PvpBoard,
});

function PvpBoard() {
  const [scope, setScope] = useState<Scope>("all");
  const [term, setTerm] = useState("");
  const players = useQuery(rankPlayersQuery());
  const mine = useMyPlayer(players.data);

  const rows = useMemo(() => {
    const query = term.trim().toLowerCase().replace(/[[\]]/g, "");
    return (players.data ?? [])
      .filter((p) => p.pvpKills + p.pkKills + p.deaths > 0)
      .filter((p) => (scope === "weekly" ? isRecent(p.lastKillAt) : true))
      .filter((p) => (query ? p.name.toLowerCase().includes(query) || (p.clanTag ?? "").toLowerCase().includes(query) : true))
      .sort((a, b) => pvpScore(b) - pvpScore(a));
  }, [players.data, scope, term]);

  return (
    <RankShell
      scope={scope}
      onScope={setScope}
      term={term}
      onTerm={setTerm}
      lore="Karma is the only law out here. Slay the lawful and it drops; hunt the chaotic and it climbs back. Weekly shows only those who killed in the last seven days."
    >
      {players.isLoading ? (
        <p className="label">COUNTING THE FALLEN…</p>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <RankTable compact
          head={
            <>
              <Th>#</Th>
              <Th>NAME [CLAN]</Th>
              <Th mobileHide>STATUS</Th>
              <Th right>PK</Th>
              <Th right>PVP</Th>
              <Th right>DEATHS</Th>
              <Th right>K/D</Th>
              <Th right>KARMA</Th>
              <Th mobileHide>LAST KILL</Th>
            </>
          }
        >
          {rows.map((player, index) => (
            <Row key={player.id} player={player} index={index} />
          ))}
          {mine ? <Row player={mine} index={rows.findIndex((p) => p.id === mine.id)} pinned /> : null}
        </RankTable>
      )}
    </RankShell>
  );
}

function Row({ player, index, pinned }: { player: RankPlayer; index: number; pinned?: boolean }) {
  return (
    <tr className={pinned ? "bg-surface" : ""}>
      <Td right>{pinned ? "MY ROW" : `${medal(index)} ${index + 1}`}</Td>
      <Td mobileHide>
        <PlayerCell player={player} />
      </Td>
      <Td>
        <StatusPill status={player.status} />
      </Td>
      <Td right>{player.pkKills}</Td>
      <Td right>{player.pvpKills}</Td>
      <Td right>{player.deaths}</Td>
      <Td right>{kd(player)}</Td>
      <Td right>
        <span className={player.karma < 0 ? "text-red-500" : ""}>{player.karma}</span>
      </Td>
      <Td mobileHide>{sinceLabel(player.lastKillAt)}</Td>
    </tr>
  );
}
