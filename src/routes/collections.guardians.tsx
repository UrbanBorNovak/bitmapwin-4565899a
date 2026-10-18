import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getGuardianMarketFn } from "@/lib/guardian-market.functions";
import { SHORD_VAULT_DISABLED } from "@/lib/shord-flag";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { collectionListingsQuery } from "@/lib/collection-sales";
import { formatSats } from "@/lib/trades";
import { BuyButton } from "@/components/BuyButton";
import { ShopListButton } from "@/components/builds/ShopListButton";
import { GuardianBrowser } from "@/components/bitmon/GuardianBrowser";
import { MyGuardianCollection } from "@/components/bitmon/MyGuardianCollection";

const PAGE = 12;
const TITLE = "Block-DNA Guardians Market — BITMAPWIN";
const DESC =
  "Buy and sell Block-DNA Guardians, children of the V6 master inscription. Signed PSBT trading, confirmed sales and a live price chart.";

const marketQuery = queryOptions({
  queryKey: ["guardian-market"],
  queryFn: () => getGuardianMarketFn(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/collections/guardians")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuardianMarket,
});

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const STEPS_ALL: { n: string; title: string; body: string; to: "/mint" | "/shord" | null; cta: string }[] = [
  {
    n: "01",
    title: "SUMMON, THEN INSCRIBE",
    body: "OPEN MINT AND PICK THE BITMAP YOU HOLD. SUMMON WAKES THE GUARDIAN IN THE OASIS; INSCRIBE MAKES IT A REAL ON-CHAIN ORDINAL CHILD OF THAT BITMAP IN YOUR WALLET. ONLY INSCRIBED GUARDIANS CAN BE LISTED.",
    to: "/mint",
    cta: "SUMMON & INSCRIBE →",
  },
  {
    n: "02",
    title: "BACK UP YOUR SHIELDED KEY",
    body: "ON THE SHIELDED VAULT PAGE, EXPORT YOUR KEY FILE. IT IS THE ONLY THING THAT CAN MOVE THE GUARDIAN OUT OF THE POOL — LOSE IT AND THE GUARDIAN IS STUCK.",
    to: "/shord",
    cta: "OPEN VAULT →",
  },
  {
    n: "03",
    title: "WITHDRAW TO YOUR WALLET",
    body: "WHEN THE MINT CONFIRMS, PRESS CHECK DEPOSIT IN THE VAULT. THEN CHOOSE WITHDRAW, PASTE YOUR ORDINALS ADDRESS AND CONFIRM. THE POOL CHECKS YOUR PROOF AND SENDS THE GUARDIAN TO THAT ADDRESS.",
    to: "/shord",
    cta: "WITHDRAW →",
  },
  {
    n: "04",
    title: "LIST IT HERE",
    body: "CONNECT THE WALLET THAT NOW HOLDS IT, FIND YOUR GUARDIAN BELOW, TYPE A PRICE IN SATS AND PRESS LIST. YOU SIGN A SALE OFFER — THE GUARDIAN STAYS IN YOUR WALLET UNTIL SOMEONE BUYS.",
    to: null,
    cta: "",
  },
];
const STEPS = SHORD_VAULT_DISABLED ? STEPS_ALL.filter((s) => s.to !== "/shord") : STEPS_ALL;

function GuardianMarket() {
  const market = useQuery(marketQuery);
  const awakened = useQuery({ ...allGuardiansQuery(), refetchInterval: 15_000 });
  const ids = market.data?.ids ?? [];
  const listings = useQuery({ ...collectionListingsQuery("guardians", ids), enabled: ids.length > 0 });
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "listed">("all");
  const [prices, setPrices] = useState<Record<string, string>>({});

  const sales = market.data?.sales ?? [];
  const salesUnknown = market.isPending || market.isError || market.data?.salesUnavailable;

  const stats = useMemo(() => {
    const open = listings.data ?? [];
    const floor = open.length ? Math.min(...open.map((o) => o.priceSats)) : null;
    const volume = sales.reduce((n, s) => n + s.priceSats, 0);
    const last = new Map<string, number>();
    for (const s of sales) if (!last.has(s.inscriptionId)) last.set(s.inscriptionId, s.priceSats);
    const ordered = [...sales].sort((a, b) => b.blockHeight - a.blockHeight);
    const lastSale = ordered[0] ?? null;
    const prev = ordered[1] ?? null;
    const delta = lastSale && prev && prev.priceSats > 0
      ? Math.round(((lastSale.priceSats - prev.priceSats) / prev.priceSats) * 100)
      : null;
    return { floor, volume, listed: open.length, last, lastSale, delta };
  }, [listings.data, sales]);

  const chart = useMemo(
    () =>
      [...sales]
        .sort((a, b) => a.blockHeight - b.blockHeight)
        .map((s) => ({ block: s.blockHeight, price: s.priceSats })),
    [sales],
  );

  const offerById = useMemo(
    () => new Map((listings.data ?? []).map((o) => [o.inscriptionId ?? "", o])),
    [listings.data],
  );
  const items = filter === "listed" ? ids.filter((id) => offerById.has(id)) : ids;
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const view = items.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
      <h1 className="display text-3xl md:text-4xl">BLOCK-DNA GUARDIANS</h1>
      <p className="label mt-2 text-muted-foreground">
        CHILDREN OF THE V6 MASTER{" "}
        {market.data ? (
          <a
            href={`https://ordinals.com/inscription/${market.data.parent}`}
            target="_blank"
            rel="noreferrer"
            className="text-bitcoin hover:underline"
            data-no-translate
          >
            {market.data.parent.slice(0, 10)}…
          </a>
        ) : null}{" "}
        · ONE PER BLOCK · TRADED BY SIGNED PSBT
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["INSCRIBED · TRADABLE", market.isPending ? "…" : String(ids.length)],
          ["OASIS AWAKENED", awakened.data ? awakened.data.length.toLocaleString() : "…"],
          ["ASKING FLOOR", stats.floor ? formatSats(stats.floor) : "NO LISTINGS"],
          [
            "LAST SALE",
            salesUnknown
              ? "—"
              : stats.lastSale
                ? `${formatSats(stats.lastSale.priceSats)} · #${stats.lastSale.blockHeight}${stats.delta !== null ? ` · ${stats.delta >= 0 ? "+" : ""}${stats.delta}%` : ""}`
                : "NO SALE YET",
          ],
          ["CONFIRMED VOLUME", salesUnknown ? "—" : stats.volume ? formatSats(stats.volume) : "0 SATS"],
          ["LISTED", `${stats.listed} / ${ids.length}`],
        ].map(([k, v]) => (
          <div key={k} className="border border-border bg-card/60 p-3 backdrop-blur">
            <div className="label text-muted-foreground">{k}</div>
            <div className="mt-1 font-mono text-lg text-foreground" data-no-translate>{v}</div>
          </div>
        ))}
      </div>
      <p className="label mt-2 text-muted-foreground">
        OASIS AWAKENED GUARDIANS LIVE IN THE APP ONLY AND CANNOT BE LISTED OR SOLD. ONLY GUARDIANS INSCRIBED AS CHILDREN OF THEIR &lt;HEIGHT&gt;.BITMAP APPEAR BELOW AND CAN BE TRADED.
      </p>
      {market.data?.indexUnavailable ? (
        <p className="label mt-2 text-destructive">ORDINALS.COM DID NOT ANSWER IN FULL — SOME GUARDIANS MAY BE MISSING</p>
      ) : null}

      <MyGuardianCollection />
      <Link to="/mint" search={{ tab: "scout" }} className="btn-term-ghost mt-3 inline-block">◇ SCOUT THE GUARDIANS OF ALL MY BITMAPS →</Link>

      {/* Tutorial */}
      <h2 className="display mt-10 text-xl">HOW TO MINT, WITHDRAW AND LIST</h2>
      <ol className="mt-3 grid gap-3 md:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="flex flex-col border border-border bg-card/60 p-3 backdrop-blur">
            <span className="font-mono text-xs text-bitcoin">{s.n}</span>
            <span className="label mt-1 text-foreground">{s.title}</span>
            <p className="mt-2 flex-1 font-mono text-[11px] leading-relaxed text-muted-foreground">{s.body}</p>
            {s.to ? (
              <Link to={s.to} className="btn-term-ghost mt-3 text-center">{s.cta}</Link>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="label mt-2 text-muted-foreground">
        A GUARDIAN STILL INSIDE THE SHIELDED POOL CANNOT BE LISTED — WITHDRAW IT FIRST.
      </p>

      {/* Price chart */}
      <h2 className="display mt-10 text-xl">PRICE HISTORY</h2>
      <div className="mt-3 h-56 border border-border bg-card/60 p-2 backdrop-blur">
        {salesUnknown ? (
          <p className="label p-3 text-muted-foreground">
            {market.isPending ? "VERIFYING SALES ON CHAIN…" : "SALE VERIFICATION UNAVAILABLE — TRY AGAIN LATER"}
          </p>
        ) : chart.length === 0 ? (
          <p className="label p-3 text-muted-foreground">
            NO CONFIRMED SALES YET · {stats.floor ? `CURRENT ASK ${formatSats(stats.floor)}` : "BE THE FIRST TO LIST"}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
              <XAxis dataKey="block" tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="var(--color-border)" />
              <YAxis width={60} tick={{ fontSize: 9, fontFamily: "monospace" }} stroke="var(--color-border)" />
              <Tooltip
                contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-border)", fontFamily: "monospace", fontSize: 10 }}
                formatter={(v: number) => [formatSats(v), "SALE"]}
                labelFormatter={(b) => `BLOCK ${b}`}
              />
              <Line type="stepAfter" dataKey="price" stroke="var(--color-bitcoin)" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Grid */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <button type="button" className={filter === "all" ? "btn-term" : "btn-term-ghost"} onClick={() => { setFilter("all"); setPage(0); }}>ALL</button>
        <button type="button" className={filter === "listed" ? "btn-term" : "btn-term-ghost"} onClick={() => { setFilter("listed"); setPage(0); }}>FOR SALE</button>
        <span className="label ml-auto">PAGE {page + 1}/{pages}</span>
        <button type="button" className="btn-term-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>PREV</button>
        <button type="button" className="btn-term-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>NEXT</button>
      </div>

      {market.isPending ? <p className="label mt-4 text-muted-foreground">READING THE COLLECTION FROM ORDINALS.COM…</p> : null}
      {!market.isPending && items.length === 0 ? (
        <p className="label mt-4 text-muted-foreground">{filter === "listed" ? "NOTHING FOR SALE RIGHT NOW" : "NO GUARDIANS FOUND YET"}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {view.map((id) => {
          const offer = offerById.get(id);
          const last = stats.last.get(id);
          const price = Number(prices[id] ?? "");
          return (
            <div key={id} className="border border-border bg-card/60 p-2 backdrop-blur">
              <iframe
                src={`https://ordinals.com/preview/${id}`}
                title={`Guardian ${id.slice(0, 8)}`}
                loading="lazy"
                sandbox="allow-scripts"
                className="aspect-square w-full border-0 bg-muted"
              />
              <div className="mt-2 flex items-baseline justify-between" data-no-translate>
                <span className="label text-foreground">{short(id)}</span>
                <a href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="label text-muted-foreground hover:text-foreground">ORD ↗</a>
              </div>
              <div className="label mt-1 text-muted-foreground" data-no-translate>
                LAST {last ? formatSats(last) : "—"} {offer ? `· ASK ${formatSats(offer.priceSats)}` : ""}
              </div>
              <div className="mt-2 space-y-1">
                {offer ? (
                  <BuyButton offerId={offer.id} priceSats={offer.priceSats} className="btn-term w-full !px-2 !py-1" />
                ) : (
                  <>
                    <input
                      inputMode="numeric"
                      placeholder="PRICE SATS"
                      value={prices[id] ?? ""}
                      onChange={(e) => setPrices({ ...prices, [id]: e.target.value.replace(/\D/g, "") })}
                      className="w-full border border-border bg-background px-2 py-1 font-mono text-xs"
                    />
                    <ShopListButton inscriptionId={id} priceSats={price} alreadyListed={false} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <GuardianBrowser />

      <h2 className="display mt-12 text-xl">CONFIRMED SALES</h2>
      <div className="mt-3 overflow-x-auto border border-border">
        <table className="w-full font-mono text-xs" data-no-translate>
          <thead className="label text-muted-foreground">
            <tr>
              <th className="p-2 text-left">GUARDIAN</th>
              <th className="p-2 text-left">PRICE</th>
              <th className="p-2 text-left">SELLER</th>
              <th className="p-2 text-left">BUYER</th>
              <th className="p-2 text-left">BLOCK</th>
              <th className="p-2 text-left">TX</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-muted-foreground">NO VERIFIED SALES YET</td></tr>
            ) : null}
            {sales.slice(0, 100).map((s) => (
              <tr key={s.txid} className="border-t border-border">
                <td className="p-2">{short(s.inscriptionId)}</td>
                <td className="p-2 text-primary">{formatSats(s.priceSats)}</td>
                <td className="p-2">{short(s.sellerAddress)}</td>
                <td className="p-2">{short(s.buyerAddress)}</td>
                <td className="p-2">{s.blockHeight}</td>
                <td className="p-2">
                  <a href={`https://mempool.space/tx/${s.txid}`} target="_blank" rel="noreferrer" className="hover:text-foreground">{s.txid.slice(0, 10)}…</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
