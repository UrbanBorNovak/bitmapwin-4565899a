import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  COIN,
  EMISSION,
  coinLeaderboardQuery,
  coinLedgerQuery,
  coinBalanceQuery,
  coinEventsQuery,
  formatBit,
  reasonLabel,
  rewardRunsQuery,
} from "@/lib/coins";
import { runDailyRewardsFn } from "@/lib/coins.functions";
import { CoinEventCard } from "@/components/coins/CoinEventCard";
import { CoinEventForm } from "@/components/coins/CoinEventForm";
import { useWalletSession } from "@/lib/wallet-session";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/coins")({
  component: CoinsPage,
  head: () => ({
    meta: [
      { title: "BIT — Bitmap Platform Coin, Rewards & Raffles" },
      {
        name: "description",
        content:
          "Earn BIT every day for the attention your bitmap builds attract, for trading and for leasing your bitmaps out, then spend it on builder raffles, giveaways and events.",
      },
      { property: "og:title", content: "BIT — Bitmap Platform Coin, Rewards & Raffles" },
      {
        property: "og:description",
        content:
          "The off-chain BIT economy: daily attention rewards for builders, coin-paid bitmap leases and builder-hosted raffles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CoinsPage() {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();

  const addresses = useMemo(
    () =>
      wallet
        ? Array.from(new Set([wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean)))
        : [],
    [wallet],
  );

  const balances = useQuery(coinBalanceQuery(addresses));
  const ledger = useQuery(coinLedgerQuery(addresses, 40));
  const events = useQuery(coinEventsQuery(60));
  const leaders = useQuery(coinLeaderboardQuery(15));
  const runs = useQuery(rewardRunsQuery(7));

  const myBalance = (balances.data ?? []).reduce((sum, b) => sum + b.balance, 0);
  const myEarned = (balances.data ?? []).reduce((sum, b) => sum + b.earnedTotal, 0);
  const open = (events.data ?? []).filter((e) => e.status === "open");
  const settled = (events.data ?? []).filter((e) => e.status !== "open");

  const payout = useMutation({
    mutationFn: () => runDailyRewardsFn(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-ledger"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-leaderboard"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-reward-runs"] });
      toast(result.skipped ? "TODAY IS ALREADY PAID" : "DAILY PAYOUT DONE", {
        description: `${formatBit(result.awarded)} TO ${result.recipients} ADDRESS(ES)`,
      });
    },
    onError: (e) => toast("PAYOUT FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <header>
        <h1 className="display text-3xl md:text-4xl">{COIN} ECONOMY</h1>
        <p className="label mt-3">
          EARNED DAILY FOR ATTENTION, TRADING, BUILDING AND LEASING — SPENT ON RAFFLES, GIVEAWAYS
          AND EVENTS
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 border border-border md:grid-cols-4">
        <Stat k="MY BALANCE" v={formatBit(myBalance)} />
        <Stat k="MY LIFETIME EARNED" v={formatBit(myEarned)} />
        <Stat k="OPEN EVENTS" v={String(open.length)} />
        <Stat
          k="LAST PAYOUT"
          v={runs.data?.[0] ? `${formatBit(runs.data[0].awarded)}` : "NOT RUN YET"}
        />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="border border-border">
          <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-5">
            <h2 className="display text-xl">DAILY EMISSION</h2>
            <button
              type="button"
              className="btn-term !px-3 !py-1.5"
              disabled={payout.isPending}
              onClick={() => payout.mutate()}
            >
              {payout.isPending ? "[ PAYING… ]" : "[ RUN TODAY'S PAYOUT ]"}
            </button>
          </header>
          <ul className="divide-y divide-border font-mono text-[11px]">
            <Rule
              label="NEW UNIQUE VISITOR ON YOUR BUILD"
              value={`${EMISSION.perUniqueVisitor} ${COIN}`}
            />
            <Rule label="NEW VIEW ON YOUR BUILD" value={`${EMISSION.perView} ${COIN}`} />
            <Rule label="EACH BUILD YOU MAINTAIN" value={`${EMISSION.perBuildMaintained} ${COIN} / DAY`} />
            <Rule label="EACH CONFIRMED TRADE" value={`${EMISSION.perTrade} ${COIN}`} />
            <Rule
              label="EACH LEASE DAY YOU GRANT"
              value={`${EMISSION.perLeaseDayEarned} ${COIN}`}
            />
            <Rule label="EACH LEASE DAY YOU RENT" value={`${EMISSION.perLeaseDayRented} ${COIN}`} />
          </ul>
          <p className="border-t border-border p-5 font-mono text-[11px] text-muted-foreground">
            &gt; ATTENTION PAYS THE MOST — BUILDS THAT PULL REAL VISITORS EARN THE BIGGEST SHARE.
            ONE PAYOUT PER DAY<span className="blink">_</span>
          </p>
        </div>

        <div className="border border-border">
          <header className="border-b border-border p-5">
            <h2 className="display text-xl">TOP HOLDERS</h2>
          </header>
          {(leaders.data ?? []).length === 0 ? (
            <p className="p-5 font-mono text-[11px] text-muted-foreground">
              &gt; NO {COIN} MINTED YET<span className="blink">_</span>
            </p>
          ) : (
            <ul className="divide-y divide-border font-mono text-[11px]">
              {(leaders.data ?? []).map((holder, i) => (
                <li key={holder.address} className="flex justify-between gap-3 p-4">
                  <span>
                    {String(i + 1).padStart(2, "0")} · {shortenAddress(holder.address)}
                  </span>
                  <span className="text-muted-foreground">{formatBit(holder.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">HOST A RAFFLE, GIVEAWAY OR EVENT</h2>
          <p className="label mt-2">ENTRANTS PAY IN {COIN} — EVERY COIN GOES TO YOUR BALANCE</p>
        </header>
        <div className="p-5">
          <CoinEventForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-xl">OPEN EVENTS</h2>
        {open.length === 0 ? (
          <p className="mt-4 border border-border p-5 font-mono text-[11px] text-muted-foreground">
            &gt; NOTHING RUNNING RIGHT NOW — HOST THE FIRST ONE<span className="blink">_</span>
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {open.map((event) => (
              <CoinEventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {settled.length > 0 ? (
        <section className="mt-10">
          <h2 className="display text-xl">SETTLED</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {settled.map((event) => (
              <CoinEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">MY {COIN} HISTORY</h2>
        </header>
        {addresses.length === 0 ? (
          <p className="p-5 font-mono text-[11px] text-muted-foreground">
            &gt; CONNECT A WALLET TO SEE YOUR EARNINGS<span className="blink">_</span>
          </p>
        ) : (ledger.data ?? []).length === 0 ? (
          <p className="p-5 font-mono text-[11px] text-muted-foreground">
            &gt; NO {COIN} MOVEMENT YET — BUILD, TRADE OR LEASE TO START EARNING
            <span className="blink">_</span>
          </p>
        ) : (
          <ul className="divide-y divide-border font-mono text-[11px]">
            {(ledger.data ?? []).map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-3 p-4">
                <span>{reasonLabel(entry.reason)}</span>
                <span className={entry.delta >= 0 ? "text-accent" : "text-muted-foreground"}>
                  {entry.delta >= 0 ? "+" : "−"}
                  {formatBit(Math.abs(entry.delta))} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex flex-wrap justify-between gap-3 p-4">
      <span>{label}</span>
      <span className="text-accent">{value}</span>
    </li>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-r border-b border-border p-5 last:border-r-0">
      <p className="label">{k}</p>
      <p className="mt-2 font-mono text-sm">{v}</p>
    </div>
  );
}
