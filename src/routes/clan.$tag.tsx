import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { toast } from "sonner";
import { RankTable, StatusPill, Td, Th } from "@/components/ranks/RankShell";
import { Button } from "@/components/ui/button";
import {
  CLAN_JOIN_XP,
  CLAN_TIERS,
  clanRosterQuery,
  clanCrestImage,
  clanScore,
  clanTier,
  clanTierProgress,
  pvpFeedQuery,
  rankClansQuery,
  rankPlayersQuery,
  sinceLabel,
  statusClass,
} from "@/lib/ranks";
import { useWalletSession } from "@/lib/wallet-session";
import { joinRankClanFn } from "@/lib/ranks.functions";
import { clanBuildsByTag } from "@/lib/world-structures.functions";

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
  const queryClient = useQueryClient();
  const joinClan = useServerFn(joinRankClanFn);
  const clans = useQuery(rankClansQuery());
  const players = useQuery(rankPlayersQuery());
  const feed = useQuery(pvpFeedQuery(60));
  const builds = useQuery({
    queryKey: ["clan-builds", tag.toUpperCase()],
    queryFn: () => clanBuildsByTag({ data: { tag } }),
    staleTime: 30_000,
  });
  const clanBuilds = builds.data?.builds ?? [];

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

  const fameTotal = members.reduce((sum, m) => sum + m.player.fame, 0);
  const pkTotal = members.reduce((sum, m) => sum + m.player.pkKills, 0);
  const full = members.length >= MAX_MEMBERS;
  const walletAddresses = wallet ? [wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean) : [];
  const currentPlayer = (players.data ?? []).find(
    (player) => player.wallet && walletAddresses.some((address) => address.toLowerCase() === player.wallet?.toLowerCase()),
  );
  const isMember = Boolean(clan && currentPlayer?.clanId === clan.id);
  const hasClan = Boolean(currentPlayer?.clanId);
  const join = useMutation({
    mutationFn: () => {
      if (!wallet) throw new Error("CONNECT YOUR WALLET FIRST");
      if (!clan) throw new Error("CLAN NOT FOUND");
      return joinClan({ data: { clanId: clan.id, wallet: wallet.ordinalsAddress } });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rank-players"] }),
        queryClient.invalidateQueries({ queryKey: ["rank-clans"] }),
        queryClient.invalidateQueries({ queryKey: ["rank-clan-roster"] }),
      ]);
      toast(`JOINED [${clan?.tag ?? tag.toUpperCase()}]`, { description: "YOUR NAME NOW CARRIES THE BANNER" });
    },
    onError: (error) => toast("JOIN FAILED", { description: (error as Error).message.toUpperCase() }),
  });

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

  const tier = clanTier(clan.xp);
  const progress = clanTierProgress(clan.xp);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-8 md:py-12" data-no-translate>
      <Link to="/ranks/clans" className="label text-bitcoin">← CLAN RANKS</Link>

      <header className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border border-border px-4 py-4">
        {clanCrestImage(clan.tag) ? (
          <img
            src={clanCrestImage(clan.tag)!}
            alt=""
            aria-hidden="true"
            className="size-16 shrink-0 border border-border object-cover sm:size-14"
            style={{ imageRendering: "pixelated", background: clan.crestColor }}
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-block size-16 shrink-0 border border-border sm:size-14"
            style={{ background: clan.crestColor }}
          />
        )}
        <div className="min-w-0">
          <h1 className="display text-xl sm:text-2xl md:text-3xl">
            <span className="mr-1 inline-block border border-bitcoin/50 px-2 py-1 text-bitcoin">[{clan.tag}]</span> {clan.name}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{clan.motto || "NO WORDS ON THE BANNER"}</p>
          <p className="label mt-2">
            TIER {tier.level} · {tier.name.toUpperCase()} · SCORE {clanScore(clan).toLocaleString("en-US")} · FOUNDED{" "}
            {new Date(clan.createdAt).toISOString().slice(0, 10)}
          </p>
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        {[
          ["MEMBERS", `${members.length} / ${MAX_MEMBERS}`],
          ["ROSTER FAME", fameTotal.toLocaleString("en-US")],
          ["CLAN PKS", pkTotal.toLocaleString("en-US")],
          ["CLAN POINTS", clan.xp.toLocaleString("en-US")],
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

      <section className="mt-3 border border-border px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="label">CLAN PROGRESSION</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {progress.next
              ? `${progress.needed.toLocaleString("en-US")} POINTS TO ${progress.next.toUpperCase()}`
              : "HIGHEST TIER REACHED"}
          </p>
        </div>

        <div className="mt-3 h-2 w-full border border-border" role="presentation">
          <div className="h-full bg-bitcoin" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>

        <ol className="mt-3 grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-7">
          {CLAN_TIERS.map((t, index) => {
            const reached = clan.xp >= t.xp;
            const current = index + 1 === tier.level;
            return (
              <li
                key={t.name}
                className={`bg-background px-3 py-2 ${current ? "border border-bitcoin/60" : ""}`}
              >
                <p className={`label ${reached ? "text-bitcoin" : "text-muted-foreground"}`}>
                  {index + 1} · {t.name.toUpperCase()}
                </p>
                <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {t.xp.toLocaleString("en-US")} PTS
                </p>
              </li>
            );
          })}
        </ol>

        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          EVERY SOUL SWORN TO THIS BANNER ADDS {CLAN_JOIN_XP} POINTS. FAME AND BLOOD COUNT TOO.
        </p>
      </section>

      <div className="mt-4 grid gap-2 sm:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)] sm:items-center">
        {wallet ? (
          <Button
            type="button"
            variant="terminal"
            size="lg"
            disabled={full || isMember || hasClan || join.isPending}
            onClick={() => join.mutate()}
            className="min-h-12 w-full text-sm sm:w-auto"
          >
            {join.isPending ? "JOINING…" : isMember ? `[ MEMBER OF ${clan.tag} ]` : full ? "[ CLAN FULL ]" : hasClan ? "[ ALREADY IN A CLAN ]" : `[ JOIN ${clan.tag} ]`}
          </Button>
        ) : (
          <Button asChild variant="terminal" size="lg" className="min-h-12 w-full text-sm sm:w-auto">
            <Link to="/wallet">[ CONNECT WALLET TO JOIN ]</Link>
          </Button>
        )}
        <Button
          type="button"
          disabled
          title={
            wallet
              ? `Founding a clan costs ${CREATE_COST_BIT} BIT — clan founding opens with the next world update`
              : "Connect your wallet to found a clan"
          }
          variant="terminalGhost"
          className="min-h-11 w-full sm:w-auto"
        >
          [ CREATE CLAN · {CREATE_COST_BIT} BIT ]
        </Button>
        <Button
          type="button"
          disabled
          title={wallet ? (full ? "This clan is full" : "Only the clan leader can invite") : "Connect your wallet to be invited"}
          variant="terminalGhost"
          className="min-h-11 w-full sm:w-auto"
        >
          [ INVITE ]
        </Button>
        <Button
          type="button"
          disabled
          title={wallet ? "You are not sworn to this banner" : "Connect your wallet first"}
          variant="terminalGhost"
          className="min-h-11 w-full sm:w-auto"
        >
          [ LEAVE ]
        </Button>
        <span className="font-mono text-[10px] leading-relaxed text-muted-foreground sm:text-right">
          {wallet ? (hasClan && !isMember ? "LEAVE YOUR CURRENT CLAN BEFORE JOINING ANOTHER" : "MAX 36 MEMBERS · VERIFIED WALLETS ONLY") : "CONNECT AND VERIFY YOUR WALLET TO JOIN A BANNER"}
        </span>
      </div>

      <h2 className="display mt-8 text-lg">ROSTER</h2>
      <div className="mt-3">
        <RankTable compact
          head={
            <>
              <Th>RANK</Th>
              <Th>NAME</Th>
              <Th mobileHide>TITLE</Th>
              <Th right>LV</Th>
              <Th right mobileHide>FAME</Th>
              <Th right mobileHide>PK</Th>
              <Th mobileHide>STATUS</Th>
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
              <Td mobileHide>{player.title.toUpperCase()}</Td>
              <Td right>{player.level}</Td>
              <Td right mobileHide>{player.fame.toLocaleString("en-US")}</Td>
              <Td right mobileHide>{player.pkKills}</Td>
              <Td mobileHide>
                <StatusPill status={player.status} />
              </Td>
            </tr>
          ))}
        </RankTable>
      </div>

      <h2 className="display mt-8 text-lg">
        CLAN STRUCTURES <span className="font-mono text-xs text-muted-foreground">{clanBuilds.length}</span>
      </h2>
      <div className="mt-3 border border-border">
        {clanBuilds.length === 0 ? (
          <p className="px-4 py-6 font-mono text-[11px] text-muted-foreground">
            NOTHING RAISED UNDER THIS BANNER — YET
          </p>
        ) : (
          <ul className="divide-y divide-border/60 font-mono text-[11px]">
            {clanBuilds.slice(0, 40).map((build) => (
              <li key={build.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <span className="text-bitcoin">{build.kind.replace(/-/g, " ").toUpperCase()}</span>
                <Link to="/bitmap/$block" params={{ block: String(build.bitmap_height) }} className="text-foreground underline-offset-2 hover:underline">
                  {build.bitmap_height}.BITMAP
                </Link>
                <span className="ml-auto text-muted-foreground">{sinceLabel(build.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
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
