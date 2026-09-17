import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  goodsMarketQuery,
  goodsTradesQuery,
  quoteOrder,
  SELL_SPREAD,
  type MarketGood,
} from "@/lib/goods-market";
import { tradeGoodsFn } from "@/lib/goods-market.functions";
import {
  addItem,
  spendItems,
  useWorldSkills,
  ITEM_LABELS,
  BACKPACK_SLOTS,
  type ItemId,
} from "@/lib/world-skills";
import { coinBalanceQuery, formatBit, COIN } from "@/lib/coins";
import { useWalletSession } from "@/lib/wallet-session";
import { shortenAddress } from "@/lib/registry";
import { PriceChart } from "@/components/game/PriceChart";

export const Route = createFileRoute("/trading-post")({
  component: TradingPostPage,
  head: () => ({
    meta: [
      { title: "Trading Post — Sell Ore and Crafted Goods for BIT" },
      {
        name: "description",
        content:
          "The Oasis goods market: sell the ore your BITMAP crews dig and the bars you smelt, or buy hides, keys and relics. Every price moves with the stock players trade.",
      },
      { property: "og:title", content: "Trading Post — Sell Ore and Crafted Goods for BIT" },
      {
        property: "og:description",
        content:
          "A live supply-and-demand market for ore, minerals, gold bars, hides, fangs, keys and relics, paid in BIT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const QUANTITIES = [1, 5, 25] as const;

function driftLabel(drift: number) {
  const percent = Math.round(drift * 100);
  if (percent > 4) return { text: `+${percent}% DEMAND`, tone: "text-bitcoin" };
  if (percent < -4) return { text: `${percent}% SUPPLY GLUT`, tone: "text-muted-foreground" };
  return { text: "AT BASELINE", tone: "text-muted-foreground" };
}

function StockBar({ good }: { good: MarketGood }) {
  const share = Math.max(0, Math.min(1.5, good.stock / Math.max(good.baselineStock, 1)));
  return (
    <div className="mt-3 h-[6px] w-full border border-border">
      <div
        className="h-full bg-bitcoin/70"
        style={{ width: `${Math.min(100, (share / 1.5) * 100)}%` }}
      />
    </div>
  );
}

function GoodRow({
  good,
  held,
  balance,
  onTrade,
  busy,
  canTrade,
}: {
  good: MarketGood;
  held: number;
  balance: number;
  busy: boolean;
  canTrade: boolean;
  onTrade: (itemId: ItemId, side: "buy" | "sell", quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState<number>(1);
  const buy = quoteOrder(good, "buy", quantity);
  const sell = quoteOrder(good, "sell", Math.min(quantity, held));
  const drift = driftLabel(good.drift);
  const affordable = buy.filled > 0 && buy.total <= balance;

  return (
    <div className="border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="display text-lg">{ITEM_LABELS[good.itemId]}</h3>
        <p className={`label ${drift.tone}`}>{drift.text}</p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs md:grid-cols-4">
        <div>
          <dt className="label">BUY AT</dt>
          <dd className="text-bitcoin">{formatBit(good.buyPrice)}</dd>
        </div>
        <div>
          <dt className="label">SELLS FOR</dt>
          <dd>{formatBit(good.sellPrice)}</dd>
        </div>
        <div>
          <dt className="label">MARKET STOCK</dt>
          <dd>{good.stock.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt className="label">IN YOUR PACK</dt>
          <dd>{held}</dd>
        </div>
      </dl>

      <StockBar good={good} />

      <div className="mt-3">
        <PriceChart itemId={good.itemId} livePrice={good.buyPrice} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {QUANTITIES.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setQuantity(amount)}
            className={`btn-term ${quantity === amount ? "text-bitcoin" : ""}`}
          >
            [ ×{amount} ]
          </button>
        ))}
        <button
          type="button"
          disabled={busy || !canTrade || sell.filled === 0}
          onClick={() => onTrade(good.itemId, "sell", sell.filled)}
          className="btn-term disabled:opacity-40"
        >
          [ SELL {sell.filled || quantity} → {formatBit(sell.total)} ]
        </button>
        <button
          type="button"
          disabled={busy || !canTrade || !affordable}
          onClick={() => onTrade(good.itemId, "buy", buy.filled)}
          className="btn-term disabled:opacity-40"
        >
          [ BUY {buy.filled || quantity} → {formatBit(buy.total)} ]
        </button>
      </div>
    </div>
  );
}

function TradingPostPage() {
  const wallet = useWalletSession();
  const skills = useWorldSkills();
  const queryClient = useQueryClient();

  const addresses = useMemo(
    () =>
      wallet
        ? Array.from(new Set([wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean)))
        : [],
    [wallet],
  );
  const payAddress = wallet?.paymentAddress || wallet?.ordinalsAddress || "";

  const market = useQuery(goodsMarketQuery());
  const trades = useQuery(goodsTradesQuery(24));
  const balances = useQuery(coinBalanceQuery(addresses));
  const balance = (balances.data ?? []).reduce((sum, row) => sum + row.balance, 0);

  const trade = useMutation({
    mutationFn: (input: { itemId: ItemId; side: "buy" | "sell"; quantity: number }) =>
      tradeGoodsFn({ data: { ...input, address: payAddress } }),
    onMutate: (input) => {
      if (input.side === "sell") spendItems({ [input.itemId]: input.quantity });
    },
    onSuccess: (result, input) => {
      if (input.side === "buy") {
        let taken = 0;
        for (let i = 0; i < result.filled; i++) {
          if (!addItem(input.itemId, 1)) break;
          taken++;
        }
        toast("BOUGHT", {
          description: `${taken} ${ITEM_LABELS[input.itemId]} FOR ${formatBit(result.totalCoins)}`,
        });
      } else {
        toast("SOLD", {
          description: `${result.filled} ${ITEM_LABELS[input.itemId]} FOR ${formatBit(result.totalCoins)}`,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["goods-market"] });
      void queryClient.invalidateQueries({ queryKey: ["goods-trades"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
    },
    onError: (error, input) => {
      // the goods never left the market — hand them straight back
      if (input.side === "sell") addItem(input.itemId, input.quantity);
      toast("TRADE FAILED", { description: (error as Error).message.toUpperCase() });
    },
  });

  const canTrade = Boolean(payAddress);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <header>
        <h1 className="display text-3xl md:text-4xl">TRADING POST</h1>
        <p className="label mt-3">
          ORE, MINERALS, BARS, HIDES, FANGS, KEYS AND RELICS — PRICED BY WHAT PLAYERS BUY AND SELL
        </p>
        <p className="mt-4 max-w-[80ch] font-mono text-xs leading-relaxed text-muted-foreground">
          &gt; EVERY GOOD HAS A BASELINE STOCK. SELLING FLOODS THE SHELVES AND THE PRICE DROPS;
          BUYING DRAINS THEM AND IT CLIMBS. THE POST PAYS{" "}
          {Math.round(SELL_SPREAD * 100)}% OF ITS ASKING PRICE, AND SETTLES IN {COIN}.
        </p>
      </header>

      <section className="mt-8 grid gap-3 border border-border p-4 font-mono text-xs md:grid-cols-3">
        <p>
          <span className="label">YOUR {COIN}</span>
          <br />
          <span className="text-bitcoin">{formatBit(balance)}</span>
        </p>
        <p>
          <span className="label">BACKPACK</span>
          <br />
          {skills.carried} / {BACKPACK_SLOTS} SLOTS
        </p>
        <p>
          <span className="label">TRADING AS</span>
          <br />
          {canTrade ? shortenAddress(payAddress) : "NO VERIFIED WALLET"}
        </p>
      </section>

      {!canTrade && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          &gt; CONNECT AND VERIFY A WALLET ON THE{" "}
          <Link to="/wallet" className="text-bitcoin underline">
            WALLET PAGE
          </Link>{" "}
          TO TRADE HERE.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-2">
          {market.isLoading && <p className="label">LOADING PRICES…</p>}
          {(market.data ?? []).map((good) => (
            <GoodRow
              key={good.itemId}
              good={good}
              held={skills.items[good.itemId] ?? 0}
              balance={balance}
              busy={trade.isPending}
              canTrade={canTrade}
              onTrade={(itemId, side, quantity) => trade.mutate({ itemId, side, quantity })}
            />
          ))}
        </div>

        <aside className="border border-border p-4">
          <p className="label">RECENT TRADES</p>
          <ul className="mt-3 space-y-2 font-mono text-xs">
            {(trades.data ?? []).length === 0 && (
              <li className="text-muted-foreground">&gt; NOTHING HAS CHANGED HANDS YET</li>
            )}
            {(trades.data ?? []).map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-3">
                <span className={entry.side === "buy" ? "text-bitcoin" : ""}>
                  {entry.side === "buy" ? "BUY" : "SELL"} {entry.quantity}×{" "}
                  {ITEM_LABELS[entry.itemId] ?? entry.itemId}
                </span>
                <span className="text-muted-foreground">{formatBit(entry.totalCoins)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
