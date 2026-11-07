import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { COIN, coinBalanceQuery, formatBit } from "@/lib/coins";
import { shortenAddress } from "@/lib/registry";
import { useWalletSession } from "@/lib/wallet-session";
import type { RankPlayer } from "@/lib/ranks";
import {
  DEMAND_CAP,
  DIVIDEND_CUT,
  ISSUE_FEE_OPEN,
  ISSUE_FEE_RAISE,
  MAX_SHARES_OFFERED,
  PLATFORM_FEE_BPS,
  SHARE_SELL_SPREAD,
  baseValueOf,
  demandMultiplier,
  platformFee,
  playerStockQuery,
  quoteShares,
  shareDividendsQuery,
  shareHoldersQuery,
  shareTradesQuery,
  sharePrice,
} from "@/lib/player-stock";
import { issuePlayerSharesFn, tradePlayerSharesFn } from "@/lib/player-stock.functions";

type Point = { t: number; price: number; issued: number };

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border px-3 py-2">
      <p className="label text-muted-foreground">{label}</p>
      <p className={`display mt-1 text-base ${accent ? "text-bitcoin" : ""}`}>{value}</p>
    </div>
  );
}

/** Share-price line, drawn only from real settled trades. */
function ShareChart({ points, base }: { points: Point[]; base: number }) {
  const w = 640;
  const h = 150;
  const pad = 6;

  if (points.length === 0) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; NO SHARES HAVE CHANGED HANDS YET — THE LINE STARTS WITH THE FIRST TRADE
      </p>
    );
  }

  const values = points.map((p) => p.price);
  const low = Math.min(...values, base);
  const high = Math.max(...values, base);
  const span = Math.max(1, high - low);
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: pad + i * stepX,
    y: h - pad - ((p.price - low) / span) * (h - pad * 2),
  }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]!.x.toFixed(1)},${h - pad} L${coords[0]!.x.toFixed(1)},${h - pad} Z`;
  const baseY = h - pad - ((base - low) / span) * (h - pad * 2);

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[150px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Share price history"
      >
        <path d={area} fill="hsl(var(--bitcoin) / 0.14)" />
        <path d={line} fill="none" stroke="hsl(var(--bitcoin))" strokeWidth="2" />
        <line
          x1={pad}
          x2={w - pad}
          y1={baseY}
          y2={baseY}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 4"
          className="text-muted-foreground"
        />
      </svg>
      <div className="mt-1 flex flex-wrap justify-between gap-2 font-mono text-[10px] text-muted-foreground">
        <span>LOW {formatBit(low)}</span>
        <span>— — EARNED BASE VALUE {formatBit(base)}</span>
        <span>HIGH {formatBit(high)}</span>
      </div>
    </div>
  );
}

/**
 * THE SHARE DESK — a stake in one ranked soul, bought and sold with BIT. The
 * price is half earned record, half live demand; holders take a cut of every
 * BIT the player earns.
 */
export function PlayerStockPanel({ player }: { player: RankPlayer }) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [offer, setOffer] = useState(100);

  const addresses = useMemo(
    () =>
      wallet ? Array.from(new Set([wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean))) : [],
    [wallet],
  );
  const payAddress = wallet?.paymentAddress || wallet?.ordinalsAddress || "";

  const stock = useQuery(playerStockQuery(player.id));
  const holders = useQuery(shareHoldersQuery(player.id));
  const trades = useQuery(shareTradesQuery(player.id));
  const dividends = useQuery(shareDividendsQuery(player.id));
  const balances = useQuery(coinBalanceQuery(addresses));

  const balance = (balances.data ?? []).reduce((sum, row) => sum + row.balance, 0);
  const base = baseValueOf(player);
  const issued = stock.data?.sharesIssued ?? 0;
  const price = sharePrice(base, issued);
  const mine = (holders.data ?? []).find((h) => h.holderAddress === payAddress) ?? null;

  const buyQuote = quoteShares(base, issued, "buy", quantity);
  const sellQuote = quoteShares(base, issued, "sell", Math.min(quantity, mine?.shares ?? 0));

  const points = useMemo<Point[]>(
    () =>
      (trades.data ?? []).map((t) => ({
        t: new Date(t.createdAt).getTime(),
        price: t.unitPrice,
        issued: t.sharesIssuedAfter,
      })),
    [trades.data],
  );

  const dividendTotal = (dividends.data ?? []).reduce((sum, d) => sum + d.totalCoins, 0);

  const trade = useMutation({
    mutationFn: (input: { side: "buy" | "sell"; shares: number }) =>
      tradePlayerSharesFn({
        data: { playerId: player.id, address: payAddress, side: input.side, shares: input.shares },
      }),
    onSuccess: (result, input) => {
      toast(input.side === "buy" ? "SHARES BOUGHT" : "SHARES SOLD", {
        description: `${result.filled} × ${player.name} FOR ${formatBit(result.totalCoins)}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["player-stock"] });
      void queryClient.invalidateQueries({ queryKey: ["player-share-holders"] });
      void queryClient.invalidateQueries({ queryKey: ["player-share-trades"] });
      void queryClient.invalidateQueries({ queryKey: ["player-share-mine"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
    },
    onError: (error) => toast("TRADE REFUSED", { description: (error as Error).message.toUpperCase() }),
  });

  const isOpen = stock.data?.isOpen ?? false;
  const offered = stock.data?.sharesOffered ?? 0;
  const remaining = Math.max(0, offered - issued);
  const isMyCharacter =
    Boolean(payAddress) &&
    addresses.some((a) => a.toLowerCase() === (player.wallet ?? "").toLowerCase());
  const issueFee = isOpen ? ISSUE_FEE_RAISE : ISSUE_FEE_OPEN;

  const issue = useMutation({
    mutationFn: (sharesOffered: number) =>
      issuePlayerSharesFn({ data: { playerId: player.id, address: payAddress, sharesOffered } }),
    onSuccess: (result) => {
      toast(isOpen ? "MORE SHARES ON OFFER" : "SHARE BOOK OPEN", {
        description: `${result.sharesOffered.toLocaleString("en-US")} SHARES OFFERED · FEE ${formatBit(result.feeCoins)}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["player-stock"] });
      void queryClient.invalidateQueries({ queryKey: ["player-stock-all"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
    },
    onError: (error) => toast("ISSUE REFUSED", { description: (error as Error).message.toUpperCase() }),
  });

  const buyFee = platformFee(buyQuote.total);
  const sellFee = platformFee(sellQuote.total);
  const busy = trade.isPending || issue.isPending;
  const canBuy =
    Boolean(payAddress) && isOpen && quantity > 0 && quantity <= remaining && buyQuote.total + buyFee <= balance;
  const canSell = Boolean(payAddress) && (mine?.shares ?? 0) >= quantity && quantity > 0;
  const canIssue = isMyCharacter && offer > 0 && issueFee <= balance && (!isOpen || offer > offered);

  return (
    <section className="mt-6 border border-border" aria-label="Player share desk">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-surface px-4 py-3">
        <h2 className="display text-base">SHARE DESK · {player.name}</h2>
        <span className="label text-muted-foreground">
          {isOpen ? "BOOK OPEN" : "BOOK NOT OPEN"} · SETTLED IN {COIN}
        </span>
      </header>

      <div className="border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="label text-muted-foreground">ISSUE SHARES</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            ON OFFER {offered.toLocaleString("en-US")} · LEFT {remaining.toLocaleString("en-US")}
          </p>
        </div>
        {isMyCharacter ? (
          <>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="label text-muted-foreground" htmlFor="share-offer">
                SHARES TO OFFER
              </label>
              <input
                id="share-offer"
                type="number"
                min={1}
                max={MAX_SHARES_OFFERED}
                value={offer}
                onChange={(e) =>
                  setOffer(Math.max(1, Math.min(MAX_SHARES_OFFERED, Number(e.target.value) || 1)))
                }
                className="w-28 border border-border bg-background px-2 py-1 font-mono text-xs"
              />
              {[100, 500, 1000].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOffer(n)}
                  className="label border border-border px-2 py-1 text-muted-foreground"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={busy || !canIssue}
                onClick={() => issue.mutate(offer)}
                className="btn-term disabled:opacity-40"
              >
                [ {isOpen ? "OFFER" : "OPEN BOOK WITH"} {offer.toLocaleString("en-US")} → FEE {formatBit(issueFee)} ]
              </button>
            </div>
            <p className="mt-3 max-w-[80ch] font-mono text-[11px] leading-relaxed text-muted-foreground">
              &gt; ONE CLICK OPENS YOUR BOOK. THE PLATFORM FEE IS {formatBit(ISSUE_FEE_OPEN)} TO OPEN AND{" "}
              {formatBit(ISSUE_FEE_RAISE)} TO OFFER MORE LATER. EVERY {COIN} PAID FOR YOUR SHARES COMES
              STRAIGHT TO YOUR WALLET, LESS THE {(PLATFORM_FEE_BPS / 100).toFixed(0)}% PLATFORM FEE.
            </p>
          </>
        ) : (
          <p className="mt-2 max-w-[80ch] font-mono text-[11px] leading-relaxed text-muted-foreground">
            &gt; ONLY {player.name.toUpperCase()} CAN ISSUE SHARES OF THIS SOUL, FROM THEIR OWN VERIFIED WALLET
            {isOpen ? "." : " — THE BOOK IS NOT OPEN FOR TRADING YET."}
          </p>
        )}
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="SHARE PRICE" value={formatBit(price)} accent />
        <Stat label="EARNED BASE VALUE" value={formatBit(base)} />
        <Stat label="DEMAND" value={`×${demandMultiplier(issued).toFixed(2)}`} />
        <Stat label="SHARES ISSUED" value={issued.toLocaleString("en-US")} />
        <Stat label="HOLDERS" value={String((holders.data ?? []).length)} />
        <Stat label={`${COIN} RAISED`} value={formatBit(stock.data?.bitRaised ?? 0)} />
        <Stat label="DIVIDENDS PAID" value={formatBit(stock.data?.dividendsPaid ?? dividendTotal)} />
        <Stat
          label="YOUR STAKE"
          value={
            mine
              ? `${mine.shares.toLocaleString("en-US")} · ${issued > 0 ? ((mine.shares / issued) * 100).toFixed(1) : "0.0"}%`
              : "NONE"
          }
          accent={Boolean(mine)}
        />
      </div>

      <div className="border-t border-border px-4 py-4">
        <p className="label text-muted-foreground">PRICE HISTORY</p>
        <div className="mt-2">
          <ShareChart points={points} base={base} />
        </div>
      </div>

      <div className="border-t border-border px-4 py-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="label text-muted-foreground" htmlFor="share-qty">
            SHARES
          </label>
          <input
            id="share-qty"
            type="number"
            min={1}
            max={500}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="w-24 border border-border bg-background px-2 py-1 font-mono text-xs"
          />
          <button
            type="button"
            disabled={busy || !canBuy}
            onClick={() => trade.mutate({ side: "buy", shares: quantity })}
            className="btn-term disabled:opacity-40"
          >
            [ BUY {quantity} → {formatBit(buyQuote.total + buyFee)} ]
          </button>
          <button
            type="button"
            disabled={busy || !canSell}
            onClick={() => trade.mutate({ side: "sell", shares: quantity })}
            className="btn-term disabled:opacity-40"
          >
            [ SELL {quantity} → {formatBit(Math.max(0, sellQuote.total - sellFee))} ]
          </button>
        </div>
        <p className="mt-3 max-w-[80ch] font-mono text-[11px] leading-relaxed text-muted-foreground">
          &gt; YOUR {COIN}: <span className="text-bitcoin">{formatBit(balance)}</span>.{" "}
          {payAddress
            ? `PAYING FROM ${shortenAddress(payAddress)}`
            : "CONNECT AND VERIFY A WALLET ON YOUR WALLET PAGE TO TRADE SHARES"}
          .
        </p>
        <p className="mt-2 max-w-[80ch] font-mono text-[11px] leading-relaxed text-muted-foreground">
          &gt; PRICE = EARNED BASE VALUE × DEMAND (CAPPED AT ×{DEMAND_CAP}). THE DESK PAYS{" "}
          {Math.round(SHARE_SELL_SPREAD * 100)}% OF ITS ASKING PRICE. HOLDERS RECEIVE{" "}
          {Math.round(DIVIDEND_CUT * 100)}% OF EVERY {COIN} THIS SOUL EARNS, SPLIT BY SHARES HELD. EVERY
          TRADE PAYS A {(PLATFORM_FEE_BPS / 100).toFixed(0)}% PLATFORM FEE (
          {formatBit(buyFee)} ON THIS BUY).
        </p>
      </div>

      <div className="grid gap-4 border-t border-border px-4 py-4 lg:grid-cols-2">
        <div>
          <p className="label text-muted-foreground">SHAREHOLDERS</p>
          {(holders.data ?? []).length === 0 ? (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              &gt; NO ONE HOLDS A STAKE IN THIS SOUL YET
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border border border-border">
              {(holders.data ?? []).map((h, i) => (
                <li key={h.id} className="flex items-baseline justify-between gap-2 px-2 py-1.5">
                  <span className="min-w-0 font-mono text-[11px]">
                    <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>{" "}
                    <span className="break-all">{shortenAddress(h.holderAddress)}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-bitcoin">
                    {h.shares.toLocaleString("en-US")} ·{" "}
                    {issued > 0 ? ((h.shares / issued) * 100).toFixed(1) : "0.0"}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="label text-muted-foreground">DIVIDEND LOG</p>
          {(dividends.data ?? []).length === 0 ? (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              &gt; NO DIVIDEND HAS BEEN PAID OUT YET
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border border border-border">
              {(dividends.data ?? []).map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-2 px-2 py-1.5 font-mono text-[11px]">
                  <span className="text-muted-foreground">
                    {new Date(d.createdAt).toISOString().slice(0, 10)} · {d.holders} HOLDERS
                  </span>
                  <span className="text-bitcoin">{formatBit(d.totalCoins)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
