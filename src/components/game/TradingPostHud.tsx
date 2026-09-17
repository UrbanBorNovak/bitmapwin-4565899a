/**
 * THE TRADING POST COUNTER — the panel that opens while you stand at the trading
 * post out west of the plaza.
 *
 * Three things happen here. You sell straight to the market at the live rate, you
 * put goods on the listing board at your own price, and you buy what is on the
 * board — including the stock the Oasis settlers put up themselves. Standing here
 * also lets the settler traders work: each visit nudges their round along, so they
 * post fresh goods and buy up player listings that are priced fairly.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { goodsMarketQuery, quoteOrder, type MarketGood } from "@/lib/goods-market";
import { PriceChart } from "@/components/game/PriceChart";
import { tradeGoodsFn } from "@/lib/goods-market.functions";
import { marketListingsQuery, settlerTradeStatsQuery } from "@/lib/market-listings";
import {
  buyListingFn,
  cancelListingFn,
  listGoodsFn,
  settlerTradeRoundFn,
} from "@/lib/market-listings.functions";
import { addItem, spendItems, useWorldSkills, ITEM_LABELS, type ItemId } from "@/lib/world-skills";
import { coinBalanceQuery, formatBit } from "@/lib/coins";
import { useWalletSession } from "@/lib/wallet-session";
import { WORLD_CELL } from "@/lib/player-state";
import { tradingPostReach } from "@/lib/world-landmarks";
import { playSfx } from "@/lib/world-audio";
import type { SelfPose } from "@/components/BitmapWorld3D";

/** how close you have to stand to the counter, in world units */
const COUNTER_REACH = WORLD_CELL * 1.6;

type Mode = "board" | "sell" | "list" | "chart";

export function TradingPostHud({ pose }: { pose: React.RefObject<SelfPose> }) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const spot = pose.current;
      setNear(spot ? tradingPostReach(spot.x, spot.z, COUNTER_REACH) : false);
    }, 400);
    return () => window.clearInterval(timer);
  }, [pose]);

  if (!near) return null;
  return <Counter />;
}

function Counter() {
  const skills = useWorldSkills();
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress ?? null;
  const client = useQueryClient();
  const [mode, setMode] = useState<Mode>("board");

  const market = useQuery(goodsMarketQuery());
  const listings = useQuery(marketListingsQuery(40));
  const settlers = useQuery(settlerTradeStatsQuery());
  const balances = useQuery({
    ...coinBalanceQuery(address ? [address] : []),
    enabled: Boolean(address),
  });
  const balance = balances.data?.[0]?.balance ?? 0;

  /** Standing here keeps the settler traders working the board. */
  useEffect(() => {
    let alive = true;
    const run = () => {
      void settlerTradeRoundFn()
        .then((result) => {
          if (!alive || result.skipped) return;
          void client.invalidateQueries({ queryKey: ["market-listings"] });
          void client.invalidateQueries({ queryKey: ["market-npc-state"] });
        })
        .catch(() => undefined);
    };
    run();
    const timer = window.setInterval(run, 65_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [client]);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["market-listings"] });
    void client.invalidateQueries({ queryKey: ["goods-market"] });
    void client.invalidateQueries({ queryKey: ["coin-balance"] });
  };

  const sellToMarket = useMutation({
    mutationFn: async (input: { itemId: ItemId; quantity: number }) => {
      if (!address) throw new Error("Connect your wallet first");
      if (!spendItems({ [input.itemId]: input.quantity })) throw new Error("Not in your pack");
      try {
        return await tradeGoodsFn({
          data: { address, itemId: input.itemId, side: "sell", quantity: input.quantity },
        });
      } catch (error) {
        addItem(input.itemId, input.quantity);
        throw error;
      }
    },
    onSuccess: (fill) => {
      playSfx("nugget");
      toast.success(`SOLD ${fill.filled} · +${formatBit(fill.totalCoins)}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const postListing = useMutation({
    mutationFn: async (input: { itemId: ItemId; quantity: number; unitPrice: number }) => {
      if (!address) throw new Error("Connect your wallet first");
      if (!spendItems({ [input.itemId]: input.quantity })) throw new Error("Not in your pack");
      try {
        return await listGoodsFn({ data: { address, ...input } });
      } catch (error) {
        addItem(input.itemId, input.quantity);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("LISTED ON THE BOARD");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const takeListing = useMutation({
    mutationFn: async (input: { listingId: string; quantity: number }) => {
      if (!address) throw new Error("Connect your wallet first");
      return buyListingFn({ data: { address, ...input } });
    },
    onSuccess: (fill) => {
      playSfx("nugget");
      addItem(fill.itemId as ItemId, fill.filled);
      toast.success(`BOUGHT ${fill.filled} · −${formatBit(fill.totalCoins)}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pullListing = useMutation({
    mutationFn: async (listingId: string) => {
      if (!address) throw new Error("Connect your wallet first");
      return cancelListingFn({ data: { address, listingId } });
    },
    onSuccess: (result) => {
      addItem(result.itemId as ItemId, result.remaining);
      toast.success("PULLED OFF THE BOARD");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy =
    sellToMarket.isPending ||
    postListing.isPending ||
    takeListing.isPending ||
    pullListing.isPending;

  const held = useMemo(
    () =>
      (Object.entries(skills.items) as [ItemId, number][])
        .filter(([, count]) => count > 0)
        .sort((a, b) => a[0].localeCompare(b[0])),
    [skills.items],
  );

  const board = listings.data ?? [];
  const mine = board.filter((row) => row.sellerAddress === address);
  const others = board.filter((row) => row.sellerAddress !== address);

  return (
    <div
      data-no-translate
      className="hud-panel absolute left-3 bottom-52 z-40 w-[min(21rem,calc(100%-1.5rem))] space-y-2 px-2.5 py-2 font-mono text-[10px]"
      aria-label="Trading post counter"
    >
      <div className="flex items-center justify-between">
        <span className="label text-[9px] text-bitcoin">THE TRADING POST</span>
        <span className="tabular-nums text-muted-foreground">{formatBit(balance)}</span>
      </div>

      <div className="flex gap-1" role="tablist">
        {(
          [
            ["board", "BOARD"],
            ["sell", "SELL"],
            ["list", "LIST"],
            ["chart", "PRICES"],
          ] as [Mode, string][]

        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`btn-term flex-1 py-1 text-[9px] ${mode === id ? "text-bitcoin" : "opacity-70"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!address ? (
        <p className="text-muted-foreground">CONNECT A VERIFIED WALLET TO TRADE HERE.</p>
      ) : null}

      {mode === "board" ? (
        <div className="max-h-[34vh] space-y-1 overflow-y-auto">
          <p className="text-muted-foreground">
            SETTLERS LISTED {settlers.data?.listed ?? 0} · BOUGHT {settlers.data?.bought ?? 0}
          </p>
          {others.length === 0 ? (
            <p className="text-muted-foreground">NOTHING ON THE BOARD RIGHT NOW.</p>
          ) : null}
          {others.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 border border-border bg-background/70 px-1.5 py-1"
            >
              <span className="truncate">
                <span className={row.sellerKind === "npc" ? "text-bitcoin" : "text-foreground"}>
                  {row.sellerKind === "npc" ? row.sellerName : "PLAYER"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {ITEM_LABELS[row.itemId]} ×{row.remaining}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="tabular-nums text-bitcoin">{formatBit(row.unitPrice)}</span>
                <button
                  type="button"
                  disabled={busy || !address || balance < row.unitPrice}
                  onClick={() => takeListing.mutate({ listingId: row.id, quantity: 1 })}
                  className="btn-term px-1.5 py-0.5 text-[9px] disabled:opacity-40"
                >
                  BUY 1
                </button>
              </span>
            </div>
          ))}

          {mine.length > 0 ? (
            <>
              <p className="label pt-1 text-[9px]">YOUR LISTINGS</p>
              {mine.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 border border-border bg-background/70 px-1.5 py-1"
                >
                  <span className="truncate text-muted-foreground">
                    {ITEM_LABELS[row.itemId]} ×{row.remaining} @{" "}
                    <span className="text-bitcoin">{formatBit(row.unitPrice)}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => pullListing.mutate(row.id)}
                    className="btn-term-ghost px-1.5 py-0.5 text-[9px] disabled:opacity-40"
                  >
                    PULL
                  </button>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {mode === "sell" ? (
        <div className="max-h-[34vh] space-y-1 overflow-y-auto">
          {held.length === 0 ? (
            <p className="text-muted-foreground">YOUR PACK IS EMPTY.</p>
          ) : null}
          {held.map(([itemId, count]) => {
            const good = market.data?.find((entry) => entry.itemId === itemId);
            const quote = good ? quoteOrder(good, "sell", Math.min(count, 5)) : null;
            return (
              <div
                key={itemId}
                className="flex items-center justify-between gap-2 border border-border bg-background/70 px-1.5 py-1"
              >
                <span className="truncate text-muted-foreground">
                  {ITEM_LABELS[itemId]} ×{count}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="tabular-nums text-bitcoin">
                    {good ? formatBit(good.sellPrice) : "—"}
                  </span>
                  <button
                    type="button"
                    disabled={busy || !good || !address}
                    onClick={() => sellToMarket.mutate({ itemId, quantity: 1 })}
                    className="btn-term px-1.5 py-0.5 text-[9px] disabled:opacity-40"
                  >
                    SELL 1
                  </button>
                  <button
                    type="button"
                    disabled={busy || !good || !address || count < 5 || !quote?.filled}
                    onClick={() => sellToMarket.mutate({ itemId, quantity: 5 })}
                    className="btn-term px-1.5 py-0.5 text-[9px] disabled:opacity-40"
                  >
                    ×5
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {mode === "list" ? <ListForm held={held} busy={busy} onList={postListing.mutate} /> : null}

      {mode === "chart" ? <PriceBoard goods={market.data ?? []} /> : null}

    </div>
  );
}

function ListForm({
  held,
  busy,
  onList,
}: {
  held: [ItemId, number][];
  busy: boolean;
  onList: (input: { itemId: ItemId; quantity: number; unitPrice: number }) => void;
}) {
  const market = useQuery(goodsMarketQuery());
  const [itemId, setItemId] = useState<ItemId | null>(held[0]?.[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);

  const stock = held.find(([id]) => id === itemId)?.[1] ?? 0;
  const good = market.data?.find((entry) => entry.itemId === itemId);
  const suggested = good?.buyPrice ?? 0;

  useEffect(() => {
    if (price === 0 && suggested > 0) setPrice(suggested);
  }, [price, suggested]);

  if (held.length === 0) {
    return <p className="text-muted-foreground">NOTHING IN YOUR PACK TO LIST.</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {held.map(([id, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setItemId(id);
              setQuantity(1);
              setPrice(0);
            }}
            className={`btn-term px-1.5 py-0.5 text-[9px] ${itemId === id ? "text-bitcoin" : "opacity-70"}`}
          >
            {ITEM_LABELS[id]} ×{count}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">QUANTITY</span>
        <input
          type="number"
          min={1}
          max={Math.max(1, stock)}
          value={quantity}
          onChange={(event) =>
            setQuantity(Math.max(1, Math.min(stock || 1, Number(event.target.value) || 1)))
          }
          className="w-16 border border-border bg-background px-1 py-0.5 text-right tabular-nums"
        />
      </label>

      <label className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">PRICE EACH</span>
        <input
          type="number"
          min={1}
          value={price}
          onChange={(event) => setPrice(Math.max(1, Number(event.target.value) || 1))}
          className="w-16 border border-border bg-background px-1 py-0.5 text-right tabular-nums"
        />
      </label>

      <p className="text-muted-foreground">
        MARKET RATE {suggested > 0 ? formatBit(suggested) : "—"} · SETTLERS BUY AT OR UNDER IT
      </p>

      <button
        type="button"
        disabled={busy || !itemId || stock < quantity || price < 1}
        onClick={() => itemId && onList({ itemId, quantity, unitPrice: price })}
        className="btn-term w-full py-1 text-[9px] disabled:opacity-40"
      >
        PUT {quantity} ON THE BOARD
      </button>
    </div>
  );
}

/** The price-movement board: pick a good, watch where its rate has been going. */
function PriceBoard({ goods }: { goods: MarketGood[] }) {
  const [itemId, setItemId] = useState<ItemId | null>(null);
  const picked = itemId ?? goods[0]?.itemId ?? null;
  const good = goods.find((entry) => entry.itemId === picked) ?? null;

  if (!good || !picked) {
    return <p className="text-muted-foreground">THE MARKET IS STILL WAKING UP.</p>;
  }

  return (
    <div className="max-h-[38vh] space-y-2 overflow-y-auto">
      <select
        value={picked}
        onChange={(event) => setItemId(event.target.value as ItemId)}
        className="w-full border border-border bg-background/80 px-1.5 py-1 text-[10px] text-foreground outline-none"
        aria-label="Pick a good to chart"
      >
        {goods.map((entry) => (
          <option key={entry.itemId} value={entry.itemId}>
            {ITEM_LABELS[entry.itemId] ?? entry.itemId}
          </option>
        ))}
      </select>

      <PriceChart itemId={picked} livePrice={good.buyPrice} />

      <div className="grid grid-cols-3 gap-1">
        <Cell k="BUY" v={formatBit(good.buyPrice)} />
        <Cell k="SELL" v={formatBit(good.sellPrice)} />
        <Cell k="STOCK" v={String(good.stock)} />
      </div>
      <p className="text-muted-foreground">
        DRIFT FROM BASE {good.drift >= 0 ? "+" : ""}
        {(good.drift * 100).toFixed(1)}% · TRADED {good.boughtTotal + good.soldTotal}
      </p>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-border bg-background/70 px-1.5 py-1">
      <div className="label text-[8px]">{k}</div>
      <div className="tabular-nums text-bitcoin">{v}</div>
    </div>
  );
}
