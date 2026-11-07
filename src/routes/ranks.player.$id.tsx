import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatusPill } from "@/components/ranks/RankShell";
import { PlayerStockPanel } from "@/components/PlayerStockPanel";
import { formatBit } from "@/lib/coins";
import {
  baseValueOf,
  playerStockQuery,
  shareHoldersQuery,
  sharePrice,
} from "@/lib/player-stock";
import {
  clanCrestImage,
  kd,
  playerEventsQuery,
  progressionScore,
  pvpScore,
  rankPlayersQuery,
  sinceLabel,
  statusClass,
} from "@/lib/ranks";

export const Route = createFileRoute("/ranks/player/$id")({
  head: () => {
    const title = "Character Record — The Oasis — BitmapWin";
    const description =
      "A character record from The Oasis: title, level, karma, player kills, fame, home bitmap and the last ten duels.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: PlayerRecord,
});

function PlayerRecord() {
  const { id } = Route.useParams();
  const players = useQuery(rankPlayersQuery());
  const events = useQuery(playerEventsQuery(id));
  const stock = useQuery(playerStockQuery(id));
  const holders = useQuery(shareHoldersQuery(id));
  const player = (players.data ?? []).find((row) => row.id === id) ?? null;

  if (players.isLoading) {
    return <p className="mx-auto max-w-[1100px] px-4 py-16 label">OPENING THE CHARACTER WINDOW…</p>;
  }
  if (!player) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-16">
        <p className="font-mono text-[11px] text-muted-foreground">NO SUCH SOUL IS WRITTEN IN THE CHRONICLES.</p>
        <Link to="/ranks" className="btn-term mt-4 inline-block">[ BACK TO RANKS ]</Link>
      </div>
    );
  }

  const levelPct = Math.min(100, Math.round(((player.level % 10) / 10) * 100));

  const base = player ? baseValueOf(player) : 25;
  const issued = stock.data?.sharesIssued ?? 0;
  const shareVal = sharePrice(base, issued);
  const holderCount = (holders.data ?? []).length;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-8 md:py-12" data-no-translate>
      <Link to="/ranks" className="label text-bitcoin">← RANKS</Link>

      <div className="mt-4 border border-border">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
          {player.clanTag ? (
            clanCrestImage(player.clanTag) ? (
              <img
                src={clanCrestImage(player.clanTag)!}
                alt=""
                aria-hidden="true"
                className="inline-block size-6 shrink-0 border border-border object-cover"
                style={{ imageRendering: "pixelated", background: player.crestColor ?? "var(--bitcoin)" }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="inline-block size-6 shrink-0 border border-border"
                style={{ background: player.crestColor ?? "var(--bitcoin)" }}
              />
            )
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {player.clanTag ? (
                <Link to="/clan/$tag" params={{ tag: player.clanTag }} className="font-mono text-[11px] text-bitcoin">
                  [{player.clanTag}]
                </Link>
              ) : null}
              <h1 className={`display text-2xl md:text-3xl ${statusClass(player.status)}`}>{player.name}</h1>
            </div>
            <div className="label mt-1">
              {player.title.toUpperCase()} · LV {player.level} · <StatusPill status={player.status} /> · KARMA{" "}
              <span className={player.karma < 0 ? "text-red-500" : ""}>{player.karma}</span>
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Clan wars are not open yet"
            className="label ml-auto cursor-not-allowed border border-border px-3 py-2 text-muted-foreground opacity-60"
          >
            [ DECLARE WAR ]
          </button>
        </header>

        <div className="border-b border-border px-4 py-3">
          <div className="label">LEVEL PROGRESS</div>
          <div className="mt-2 h-2 w-full border border-border">
            <div className="h-full bg-bitcoin" style={{ width: `${levelPct}%` }} />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {[
            ["PK KILLS", player.pkKills.toLocaleString("en-US")],
            ["PVP KILLS", player.pvpKills.toLocaleString("en-US")],
            ["DEATHS", player.deaths.toLocaleString("en-US")],
            ["K/D", kd(player)],
            ["FAME", player.fame.toLocaleString("en-US")],
            ["BIT EARNED", player.bitEarned.toLocaleString("en-US")],
            ["DISTRICTS VISITED", player.districtsVisited.toLocaleString("en-US")],
            ["BUILDS MAINTAINED", player.buildsMaintained.toLocaleString("en-US")],
            ["PROGRESSION SCORE", progressionScore(player).toLocaleString("en-US")],
            ["PVP SCORE", Math.round(pvpScore(player)).toLocaleString("en-US")],
            ["TIMES CHAOTIC", player.chaoticCount.toLocaleString("en-US")],
            ["LAST DEATH", sinceLabel(player.lastDeathAt)],
            ["SHARE PRICE", formatBit(shareVal)],
            ["SHARES ISSUED", issued.toLocaleString("en-US")],
            ["SHARE HOLDERS", holderCount.toLocaleString("en-US")],
            ["DIVIDENDS PAID", formatBit(stock.data?.dividendsPaid ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="bg-background px-4 py-3">
              <dt className="label">{label}</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-border px-4 py-3 font-mono text-[11px]">
          HOME:{" "}
          {player.homeBitmap === null ? (
            "—"
          ) : (
            <Link to="/bitmap/$block" params={{ block: String(player.homeBitmap) }} className="text-signal hover:underline">
              {player.homeBitmap}.BITMAP
            </Link>
          )}
          <span className="ml-4">LAST DISTRICT: {(player.lastDistrict ?? "UNKNOWN").toUpperCase()}</span>
        </div>
      </div>

      <PlayerStockPanel player={player} />

      <h2 className="display mt-8 text-lg">LAST DUELS</h2>
      <div className="mt-3 border border-border">
        {events.isLoading ? (
          <p className="px-4 py-6 font-mono text-[11px] text-muted-foreground">READING THE BLOOD LEDGER…</p>
        ) : (events.data ?? []).length === 0 ? (
          <p className="px-4 py-6 font-mono text-[11px] text-muted-foreground">
            NO BLOOD HAS BEEN SPILLED IN THE OASIS — YET
          </p>
        ) : (
          <ul className="divide-y divide-border/60 font-mono text-[11px]">
            {(events.data ?? []).map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <span className={event.killerId === player.id ? "text-bitcoin" : "text-foreground"}>
                  {(event.killerName ?? "SOMEONE").toUpperCase()}
                </span>
                <span className="text-muted-foreground">HAS KILLED</span>
                <span className={event.victimId === player.id ? "text-red-500" : "text-foreground"}>
                  {(event.victimName ?? "SOMEONE").toUpperCase()}
                </span>
                {event.bitmap !== null ? (
                  <span className="text-muted-foreground">IN {event.bitmap}.BITMAP</span>
                ) : null}
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
