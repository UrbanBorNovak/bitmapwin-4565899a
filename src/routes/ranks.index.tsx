import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  isRecent,
  medal,
  progressionScore,
  rankPlayersQuery,
  sinceLabel,
  type RankPlayer,
} from "@/lib/ranks";

export const Route = createFileRoute("/ranks/")({
  head: () => {
    const title = "Ranks — Oasis Hall of Fame — BitmapWin";
    const description =
      "The progression ladder of The Oasis: levels, titles, fame, karma and clan tags for every soul walking Bitcoin land.";
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
  component: ProgressionBoard,
});

function ProgressionBoard() {
  const [scope, setScope] = useState<Scope>("all");
  const [term, setTerm] = useState("");
  const players = useQuery(rankPlayersQuery());
  const mine = useMyPlayer(players.data);

  const rows = useMemo(() => {
    const query = term.trim().toLowerCase();
    return (players.data ?? [])
      .filter((p) => (scope === "weekly" ? isRecent(p.lastKillAt) || isRecent(p.lastDeathAt) : true))
      .filter((p) =>
        query
          ? p.name.toLowerCase().includes(query) || (p.clanTag ?? "").toLowerCase().includes(query.replace(/[[\]]/g, ""))
          : true,
      )
      .sort((a, b) => progressionScore(b) - progressionScore(a));
  }, [players.data, scope, term]);

  return (
    <RankShell
      scope={scope}
      onScope={setScope}
      term={term}
      onTerm={setTerm}
      lore="Level, fame, land walked and builds kept standing. Weekly counts only those seen in blood this week; all time counts everything since the first block."
    >
      {players.isLoading ? (
        <p className="label">READING THE CHRONICLES…</p>
      ) : rows.length === 0 ? (
        <EmptyState note="NO SOULS MATCH THAT NAME IN THE OASIS" />
      ) : (
        <RankTable compact
          head={
            <>
              <Th>#</Th>
              <Th>NAME [CLAN]</Th>
              <Th mobileHide>TITLE</Th>
              <Th right>LV</Th>
              <Th right>FAME</Th>
              <Th mobileHide>STATUS</Th>
              <Th mobileHide>HOME .BITMAP</Th>
              <Th mobileHide>LAST SEEN</Th>
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
      <Td right>
        {pinned ? "MY ROW" : `${medal(index)} ${index + 1}`}
      </Td>
      <Td>
        <PlayerCell player={player} />
      </Td>
      <Td mobileHide>{player.title.toUpperCase()}</Td>
      <Td right>{player.level}</Td>
      <Td right>{player.fame.toLocaleString("en-US")}</Td>
      <Td mobileHide>
        <StatusPill status={player.status} />
      </Td>
      <Td mobileHide>
        {player.homeBitmap === null ? (
          "—"
        ) : (
          <Link
            to="/bitmap/$block"
            params={{ block: String(player.homeBitmap) }}
            className="text-signal hover:underline"
          >
            {player.homeBitmap}.BITMAP
          </Link>
        )}
      </Td>
      <Td mobileHide>
        {(player.lastDistrict ?? "UNKNOWN").toUpperCase()}
        <span className="ml-2 text-muted-foreground">{sinceLabel(player.lastKillAt ?? player.lastDeathAt)}</span>
      </Td>
    </tr>
  );
}
