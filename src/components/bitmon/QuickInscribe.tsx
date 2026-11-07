import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useWalletSession } from "@/lib/wallet-session";
import { walletQuery } from "@/lib/wallet";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { TRIBUTE_SATS } from "@/lib/guardian-delegate";
import { GUARDIAN_PRICE_SATS } from "@/lib/bitmon";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";
import { guardianDnaQuery, guardianQuery } from "@/lib/bitmon-queries";

/** Chance of each tier from the block-hash roll in guardianFromBlock (before era bumps). */
const BASE_ODDS = { COMMON: "68%", RARE: "22%", EPIC: "8%", MYTHIC: "2%" } as const;
const TONE = { COMMON: "text-muted-foreground", RARE: "text-signal", EPIC: "text-signal", MYTHIC: "text-bitcoin" } as const;

type Status = "INSCRIBED" | "TRIBUTE PAID" | "ASLEEP" | "…";
type Filter = "ALL" | "TRIBUTE PAID" | "INSCRIBED" | "ASLEEP";
const FILTERS: Filter[] = ["ALL", "TRIBUTE PAID", "INSCRIBED", "ASLEEP"];

function RarityLine({ height }: { height: number }) {
  const q = useQuery({ ...guardianDnaQuery(height), staleTime: Infinity });
  if (!q.data) return <p className="text-muted-foreground">{q.isError ? "RARITY UNAVAILABLE" : "READING BLOCK…"}</p>;
  const r = q.data.rarity;
  const why = height < 10_000 ? "BLOCK UNDER 10,000 → ALWAYS MYTHIC" : q.data.epoch === 0 ? "ERA 0 → +1 TIER" : `${BASE_ODDS[r]} OF BLOCKS ROLL THIS`;
  return <p className={TONE[r]} title={why}>{r} · {q.data.species}</p>;
}

/**
 * Quick Inscribe: lists the BITMAPs the connected wallet holds (live scan) and
 * shows for each whether its Guardian is inscribed on chain, tribute-paid
 * (awake, ready to inscribe) or still asleep. Filters narrow the grid.
 */
export function QuickInscribe({ current, onPick, onAwaken }: { current: number; onPick: (h: number) => void; onAwaken: (h: number) => void }) {
  const wallet = useWalletSession();
  const live = useQuery(walletQuery(wallet?.ordinalsAddress ?? ""));
  const inhabited = useQuery(inhabitedQuery());
  const [filter, setFilter] = useState<Filter>("ALL");

  if (!wallet) {
    return (
      <section className="rounded-md border border-border bg-card p-4">
        <p className="label text-bitcoin">QUICK INSCRIBE</p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">CONNECT YOUR WALLET TO SEE YOUR BITMAPS AND INSCRIBE THEIR GUARDIANS IN ONE STEP.</p>
        <Link to="/wallet" className="btn-term mt-3 inline-block">[ CONNECT WALLET ]</Link>
      </section>
    );
  }

  const heights = live.data
    ? [...new Set(live.data.utxos.flatMap((u) => u.inscriptions.map((i) => i.bitmapHeight)).filter((h): h is number => h !== null))].sort((a, b) => a - b)
    : [];
  const done = inhabited.data;

  return (
    <section className="relative isolate rounded-md border border-border bg-card p-4" aria-label="Quick inscribe">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-bitcoin">QUICK INSCRIBE · YOUR BITMAPS</p>
        <p className="font-mono text-[10px] text-muted-foreground">{live.isLoading ? "SCANNING WALLET…" : `${heights.length} HELD`}</p>
      </div>
      <p className="mt-2 max-w-2xl font-mono text-[11px] text-muted-foreground">
        PICK A BITMAP → ONE WALLET SIGNATURE INSCRIBES ITS GUARDIAN AS A CHILD OF THAT BITMAP. COST: LIVE MINER FEE + {TRIBUTE_SATS.toLocaleString("en-US")} SAT TRIBUTE INSIDE THE SAME TRANSACTION. YOUR BITMAP RETURNS TO YOUR WALLET. CHOOSE THE ENGINE (V8 THREE.JS OR V7) IN THE INSCRIBE PANEL BELOW.
      </p>
      <p className="mt-2 max-w-2xl font-mono text-[10px] text-muted-foreground">
        RARITY IS FIXED BY EACH BLOCK'S HASH: COMMON 68% · RARE 22% · EPIC 8% · MYTHIC 2%. ERA 0 BLOCKS MOVE UP ONE TIER; BLOCKS UNDER 10,000 ARE ALWAYS MYTHIC.
      </p>
      <div className="mt-3 flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={`border px-2 py-1 font-mono text-[10px] ${filter === f ? "border-bitcoin bg-bitcoin/15 text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {f}
          </button>
        ))}
      </div>
      {live.isError ? <p className="mt-3 font-mono text-[11px] text-destructive">COULD NOT SCAN YOUR WALLET RIGHT NOW. TRY AGAIN SHORTLY.</p> : null}
      {!live.isLoading && heights.length === 0 && !live.isError ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">NO BITMAPS FOUND IN THIS WALLET.</p>
      ) : null}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {heights.map((h) => (
          <GuardianCard key={h} height={h} chainId={done?.get(h) ?? null} current={h === current} filter={filter} onPick={onPick} onAwaken={onAwaken} />
        ))}
      </ul>
    </section>
  );
}

function GuardianCard({ height: h, chainId, current, filter, onPick, onAwaken }: { height: number; chainId: string | null; current: boolean; filter: Filter; onPick: (h: number) => void; onAwaken: (h: number) => void }) {
  const g = useQuery(guardianQuery(h));
  const id = chainId ?? g.data?.inscriptionId ?? null;
  const status: Status = id ? "INSCRIBED" : g.data ? "TRIBUTE PAID" : g.isPending ? "…" : "ASLEEP";
  if (filter !== "ALL" && status !== filter) return null;
  const tone = status === "INSCRIBED" ? "border-signal bg-signal/15 text-signal" : status === "TRIBUTE PAID" ? "border-bitcoin bg-bitcoin/15 text-bitcoin" : "border-border text-muted-foreground";
  return (
    <li className={`flex items-center gap-3 border bg-background p-2 ${current ? "border-bitcoin" : "border-border"}`}>
      <div className="size-12 shrink-0 border border-border"><GuardianPortrait height={h} size={48} /></div>
      <div className="min-w-0 flex-1 font-mono text-[10px]">
        <p className="flex items-center justify-between gap-2 text-foreground">{h}.BITMAP<span className={`border px-1 text-[9px] ${tone}`}>{status === "INSCRIBED" ? "✓ INSCRIBED" : status}</span></p>
        <RarityLine height={h} />
        {id ? (
          <div className="flex flex-wrap gap-x-2">
            <a href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="text-signal underline">VIEW ON CHAIN ↗</a>
            <button type="button" onClick={() => onPick(h)} className="text-muted-foreground underline hover:text-foreground" title="Inscribe an extra copy on a newer engine">NEW ENGINE →</button>
          </div>
        ) : g.data ? (
          <button type="button" onClick={() => onPick(h)} className="text-bitcoin underline hover:text-foreground">◆ INSCRIBE →</button>
        ) : g.isPending ? null : (
          <button type="button" onClick={() => onAwaken(h)} className="text-bitcoin underline hover:text-foreground">⚡ AWAKEN · {GUARDIAN_PRICE_SATS.toLocaleString("en-US")} SATS</button>
        )}
      </div>
    </li>
  );
}
