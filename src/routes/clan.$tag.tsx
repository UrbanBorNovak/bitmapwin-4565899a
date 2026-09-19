import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { RankTable, StatusPill, Td, Th } from "@/components/ranks/RankShell";
import {
  clanRosterQuery,
  clanScore,
  pvpFeedQuery,
  rankClansQuery,
  rankPlayersQuery,
  sinceLabel,
  statusClass,
} from "@/lib/ranks";
import { useWalletSession } from "@/lib/wallet-session";

const CREATE_COST_BIT = 500;
const MAX_MEMBERS = 36;
const RANK_ORDER = { leader: 0, knight: 1, member: 2, academy: 3 } as const;

export const Route = createFileRoute("/clan/$tag")({
  head: () => {
    const title = "Clan Hall — The Oasis — BitmapWin";
    const description =
      "A clan hall in The Oasis: crest, motto, leader, sworn roster, clan totals and the most recent kills under the banner.";
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
  component: ClanHall,
});

function ClanHall() {
  const { tag } = Route.useParams();
  const wallet = useWalletSession();
  const clans = useQuery(rankClansQuery());
  const players = useQuery(rankPlayersQuery());
  const feed = useQuery(pvpFeedQuery(60));

  const clan = (clans.data ?? []).find((row) => row.tag.toUpperCase() === tag.toUpperCase()) ?? null;
  const roster = useQuery(clanRosterQuery(clan?.id ?? null));

  const members = useMemo(() => {
    if (!clan) return [];
    const ranks = new Map((roster.data ?? []).map((row) => [row.playerId, row.rank]));
    return (players.data ?? [])
      .filter((player) => player.clanId === clan.id)
      .map((player) => ({ player, rank: ranks.get(player.id) ?? ("member" as const) }))
      .sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || b.player.level - a.player.level);
  }, [clan, players.data, roster.data]);

  const kills = useMemo(() => {
    const ids = new Set(members.map((m) => m.player.id));
    return (feed.data ?? []).filter((event) => event.killerId && ids.has(event.killerId)).slice(0, 10);
  }, [feed.data, members]);

  if (clans.isLoading) {
    return <p className="mx-auto max-w-[1100px] px-4 py-16 label">OPENING THE CLAN HALL…</p>;
  }
  if (!clan) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-16">
        <p className="font-mono text-[11px] text-muted-foreground">NO BANNER CARRIES THE TAG [{tag.toUpperCase()}].</p>
        <Link to="/ranks/clans" className="btn-term mt-4 inline-block">[ ALL CLANS ]</Link>
      </div>
    );
  }

  const fameTotal = members.reduce((sum, m) => sum + m.player.fame, 0);
  const pkTotal = members.reduce((sum, m) => sum + m.player.pkKills, 0);
  const full = members.length >= MAX_MEMBERS;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-8 md:py-12" data-no-translate>
      <Link to="/ranks/clans" className="label text-bitcoin">← CLAN RANKS</Link>

      <header className="mt-4 flex flex-wrap items-center gap-4 border border-border px-4 py-4">
        <span
          aria-hidden="true"
          className="inline-block size-12 border border-border"
          style={{ background: clan.crestColor }}
        />
        <div className="min-w-0">
          <h1 className="display text-2xl md:text-3xl">
            <span className="text-bitcoin">[{clan.tag}]</span> {clan.name}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{clan.motto || "NO WORDS ON THE BANNER"}</p>
          <p className="label mt-2">
            LEVEL {clan.level} · SCORE {clanScore(clan).toLocaleString()} · FOUNDED{" "}
            {new Date(clan.createdAt).toISOString().slice(0, 10)}
          </p>
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        {[
          ["MEMBERS", `${members.length} / ${MAX_MEMBERS}`],
          ["ROSTER FAME", fameTotal.toLocaleString()],
          ["CLAN PKS", pkTotal.toLocaleString()],
          [
            "HOME BITMAP",
            clan.homeBitmap === null ? "—" : `${clan.homeBitmap}.BITMAP`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="bg-background px-4 py-3">
            <dt className="label">{label}</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled
          title={
            wallet
              ? `Founding a clan costs ${CREATE_COST_BIT} BIT — clan founding opens with the next world update`
              : "Connect your wallet to found a clan"
          }
          className="label cursor-not-allowed border border-border px-3 py-2 text-muted-foreground opacity-60"
        >
          [ CREATE CLAN · {CREATE_COST_BIT} BIT ]
        </button>
        <button
          type="button"
          disabled
          title={wallet ? (full ? "This clan is full" : "Only the clan leader can invite") : "Connect your wallet to be invited"}
          className="label cursor-not-allowed border border-border px-3 py-2 text-muted-foreground opacity-60"
        >
          [ INVITE ]
        </button>
        <button
          type="button"
          disabled
          title={wallet ? "You are not sworn to this banner" : "Connect your wallet first"}
          className="label cursor-not-allowed border border-border px-3 py-2 text-muted-foreground opacity-60"
        >
          [ LEAVE ]
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">
          {wallet ? "TAG 2–6 A–Z · NAME 3–24 CHARS · MAX 36 MEMBERS" : "CONNECT A WALLET TO JOIN A BANNER"}
        </span>
      </div>

      <h2 className="display mt-8 text-lg">ROSTER</h2>
      <div className="mt-3">
        <RankTable
          head={
            <>
              <Th>RANK</Th>
              <Th>NAME</Th>
              <Th>TITLE</Th>
              <Th right>LV</Th>
              <Th right>FAME</Th>
              <Th right>PK</Th>
              <Th>STATUS</Th>
            </>
          }
        >
          {members.map(({ player, rank }) => (
            <tr key={player.id}>
              <Td>{rank.toUpperCase()}</Td>
              <Td>
                <Link
                  to="/ranks/player/$id"
                  params={{ id: player.id }}
                  className={`font-bold hover:underline ${statusClass(player.status)}`}
                >
                  {player.name}
                </Link>
              </Td>
              <Td>{player.title.toUpperCase()}</Td>
              <Td right>{player.level}</Td>
              <Td right>{player.fame.toLocaleString()}</Td>
              <Td right>{player.pkKills}</Td>
              <Td>
                <StatusPill status={player.status} />
              </Td>
            </tr>
          ))}
        </RankTable>
      </div>

      <h2 className="display mt-8 text-lg">RECENT CLAN KILLS</h2>
      <div className="mt-3 border border-border">
        {kills.length === 0 ? (
          <p className="px-4 py-6 font-mono text-[11px] text-muted-foreground">
            NO BLOOD HAS BEEN SPILLED IN THE OASIS — YET
          </p>
        ) : (
          <ul className="divide-y divide-border/60 font-mono text-[11px]">
            {kills.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <span className="text-bitcoin">{(event.killerName ?? "SOMEONE").toUpperCase()}</span>
                <span className="text-muted-foreground">HAS KILLED</span>
                <span className="text-foreground">{(event.victimName ?? "SOMEONE").toUpperCase()}</span>
                {event.bitmap !== null ? <span className="text-muted-foreground">IN {event.bitmap}.BITMAP</span> : null}
                {event.wasPk ? <span className="text-red-500">☠ PK</span> : null}
                <span className="ml-auto text-muted-foreground">{sinceLabel(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
