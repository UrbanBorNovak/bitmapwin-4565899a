import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  EmptyState,
  PlayerCell,
  RankShell,
  RankTable,
  Td,
  Th,
  type Scope,
} from "@/components/ranks/RankShell";
import { rankPlayersQuery, type RankPlayer } from "@/lib/ranks";
import { COIN, coinBalanceQuery, formatBit } from "@/lib/coins";
import { useWalletSession } from "@/lib/wallet-session";
import {
  DEMAND_CAP,
  DIVIDEND_CUT,
  SHARE_SELL_SPREAD,
  allPlayerStockQuery,
  baseValueOf,
  demandMultiplier,
  myHoldingsQuery,
  sharePrice,
} from "@/lib/player-stock";

export const Route = createFileRoute("/ranks/shares")({
  head: () => {
    const title = "Share Market — Buy and Sell Player Shares — BitmapWin";
    const description =
      "The open share market of The Oasis: buy and sell stakes in ranked players with BIT, watch prices move with demand and earn a cut of everything they earn.";
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
  component: ShareMarket,
});

type Row = {
  player: RankPlayer;
  base: number;
  issued: number;
  price: number;
  raised: number;
  dividends: number;
  mine: number;
};

function ShareMarket() {
  const [scope, setScope] = useState<Scope>("all");
  const [term, setTerm] = useState("");

  const wallet = useWalletSession();
  const addresses = useMemo(
    () =>
      wallet ? Array.from(new Set([wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean))) : [],
    [wallet],
  );

  const players = useQuery(rankPlayersQuery());
  const stock = useQuery(allPlayerStockQuery());
  const holdings = useQuery(myHoldingsQuery(addresses as string[]));
  const balances = useQuery(coinBalanceQuery(addresses as string[]));

  const balance = (balances.data ?? []).reduce((sum, row) => sum + row.balance, 0);

  const rows = useMemo<Row[]>(() => {
    const books = new Map((stock.data ?? []).map((s) => [s.playerId, s]));
    const mineBy = new Map<string, number>();
    for (const h of holdings.data ?? []) {
      mineBy.set(h.playerId, (mineBy.get(h.playerId) ?? 0) + h.shares);
    }
    const query = term.trim().toLowerCase();
    return (players.data ?? [])
      .filter((p) =>
        query
          ? p.name.toLowerCase().includes(query) ||
            (p.clanTag ?? "").toLowerCase().includes(query.replace(/[[\]]/g, ""))
          : true,
      )
      .map((player) => {
        const book = books.get(player.id);
        const base = baseValueOf(player);
        const issued = book?.sharesIssued ?? 0;
        return {
          player,
          base,
          issued,
          price: sharePrice(base, issued),
          raised: book?.bitRaised ?? 0,
          dividends: book?.dividendsPaid ?? 0,
          mine: mineBy.get(player.id) ?? 0,
        };
      })
      .filter((row) => (scope === "weekly" ? row.issued > 0 : true))
      .sort((a, b) => b.price - a.price);
  }, [players.data, stock.data, holdings.data, term, scope]);

  const myShares = rows.reduce((sum, row) => sum + row.mine, 0);
  const myValue = rows.reduce(
    (sum, row) => sum + Math.max(1, Math.floor(row.price * SHARE_SELL_SPREAD)) * row.mine,
    0,
  );

  return (
    <RankShell
      scope={scope}
      onScope={setScope}
      term={term}
      onTerm={setTerm}
      lore={`Every ranked soul has a share book. A share costs their earned record times live demand, capped at ×${DEMAND_CAP}; the desk buys back at ${Math.round(
        SHARE_SELL_SPREAD * 100,
      )}% of the asking price, and holders take ${Math.round(
        DIVIDEND_CUT * 100,
      )}% of every ${COIN} that soul earns. WEEKLY shows only books that already have shares out.`}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`YOUR ${COIN}`} value={formatBit(balance)} accent />
        <Stat label="YOUR SHARES" value={myShares.toLocaleString("en-US")} />
        <Stat label="SELL-BACK VALUE" value={formatBit(myValue)} />
        <Stat label="BOOKS OPEN" value={String(rows.length)} />
      </div>

      <div className="mt-6">
        {players.isLoading ? (
          <p className="label">READING THE SHARE BOOKS…</p>
        ) : rows.length === 0 ? (
          <EmptyState note="NO SOULS MATCH THAT NAME IN THE OASIS" />
        ) : (
          <RankTable
            head={
              <>
                <Th>#</Th>
                <Th>NAME [CLAN]</Th>
                <Th right>PRICE</Th>
                <Th right mobileHide>
                  BASE
                </Th>
                <Th right mobileHide>
                  DEMAND
                </Th>
                <Th right mobileHide>
                  ISSUED
                </Th>
                <Th right mobileHide>
                  {COIN} RAISED
                </Th>
                <Th right>YOURS</Th>
                <Th>DESK</Th>
              </>
            }
          >
            {rows.map((row, index) => (
              <tr key={row.player.id} className="hover:bg-surface/60">
                <Td>{String(index + 1).padStart(2, "0")}</Td>
                <Td>
                  <PlayerCell player={row.player} />
                </Td>
                <Td right>
                  <span className="text-bitcoin">{formatBit(row.price)}</span>
                </Td>
                <Td right mobileHide>
                  {formatBit(row.base)}
                </Td>
                <Td right mobileHide>
                  ×{demandMultiplier(row.issued).toFixed(2)}
                </Td>
                <Td right mobileHide>
                  {row.issued.toLocaleString("en-US")}
                </Td>
                <Td right mobileHide>
                  {formatBit(row.raised)}
                </Td>
                <Td right>
                  {row.mine > 0 ? (
                    <span className="text-bitcoin">{row.mine.toLocaleString("en-US")}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
                <Td>
                  <Link
                    to="/ranks/player/$id"
                    params={{ id: row.player.id }}
                    className="border border-border px-2 py-1 text-[10px] hover:border-bitcoin hover:text-bitcoin"
                  >
                    [ TRADE ]
                  </Link>
                </Td>
              </tr>
            ))}
          </RankTable>
        )}
      </div>

      <p className="mt-4 max-w-[80ch] font-mono text-[11px] leading-relaxed text-muted-foreground">
        &gt; BUYING AND SELLING HAPPENS ON EACH SOUL&apos;S SHARE DESK. CONNECT AND VERIFY A WALLET ON
        YOUR WALLET PAGE TO TRADE.
      </p>
    </RankShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border px-3 py-2">
      <p className="label text-muted-foreground">{label}</p>
      <p className={`display mt-1 text-base ${accent ? "text-bitcoin" : ""}`}>{value}</p>
    </div>
  );
}
