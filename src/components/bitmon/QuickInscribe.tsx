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

function RarityLine({ height }: { height: number }) {
  const q = useQuery({ ...guardianDnaQuery(height), staleTime: Infinity });
  if (!q.data) return <p className="text-muted-foreground">{q.isError ? "RARITY UNAVAILABLE" : "READING BLOCK…"}</p>;
  const r = q.data.rarity;
  const why = height < 10_000 ? "BLOCK UNDER 10,000 → ALWAYS MYTHIC" : q.data.epoch === 0 ? "ERA 0 → +1 TIER" : `${BASE_ODDS[r]} OF BLOCKS ROLL THIS`;
  return <p className={TONE[r]} title={why}>{r} · {q.data.species}<span className="block text-muted-foreground">{why}</span></p>;
}

/**
 * Quick Inscribe: lists the BITMAPs the connected wallet holds (live scan) and
 * marks which already carry an inscribed Guardian (read from chain children).
 * Picking one loads it into the real delegate inscribe flow below.
 */
export function QuickInscribe({ current, onPick, onAwaken }: { current: number; onPick: (h: number) => void; onAwaken: (h: number) => void }) {
  const wallet = useWalletSession();
  const live = useQuery(walletQuery(wallet?.ordinalsAddress ?? ""));
  const inhabited = useQuery(inhabitedQuery());

  if (!wallet) {
    return (
      <section className="panel rounded-md border border-border p-4">
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
  const waiting = heights.filter((h) => !done?.has(h)).length;

  return (
    <section className="panel rounded-md border border-border p-4" aria-label="Quick inscribe">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-bitcoin">QUICK INSCRIBE · YOUR BITMAPS</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {live.isLoading ? "SCANNING WALLET…" : `${heights.length} HELD · ${waiting} WAITING FOR A GUARDIAN`}
        </p>
      </div>
      <p className="mt-2 max-w-2xl font-mono text-[11px] text-muted-foreground">
        PICK A BITMAP → ONE WALLET SIGNATURE INSCRIBES ITS GUARDIAN AS A CHILD OF THAT BITMAP. COST: LIVE MINER FEE + {TRIBUTE_SATS.toLocaleString()} SAT TRIBUTE INSIDE THE SAME TRANSACTION. YOUR BITMAP RETURNS TO YOUR WALLET.
      </p>
      <p className="mt-2 max-w-2xl font-mono text-[10px] text-muted-foreground">
        RARITY IS FIXED BY EACH BLOCK'S HASH, SO IT IS KNOWN BEFORE YOU INSCRIBE: COMMON 68% · RARE 22% · EPIC 8% · MYTHIC 2%. ERA 0 BLOCKS (UNDER 210,000) MOVE UP ONE TIER; BLOCKS UNDER 10,000 ARE ALWAYS MYTHIC.
      </p>
      {live.isError ? <p className="mt-3 font-mono text-[11px] text-destructive">COULD NOT SCAN YOUR WALLET RIGHT NOW. TRY AGAIN SHORTLY.</p> : null}
      {!live.isLoading && heights.length === 0 && !live.isError ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">NO BITMAPS FOUND IN THIS WALLET.</p>
      ) : null}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {heights.map((h) => (
          <GuardianCard key={h} height={h} chainId={done?.get(h) ?? null} current={h === current} onPick={onPick} onAwaken={onAwaken} />
        ))}
      </ul>
    </section>
  );
}

function GuardianCard({ height: h, chainId, current, onPick, onAwaken }: { height: number; chainId: string | null; current: boolean; onPick: (h: number) => void; onAwaken: (h: number) => void }) {
  const g = useQuery(guardianQuery(h));
  const id = chainId ?? g.data?.inscriptionId ?? null;
  const status = id ? "INSCRIBED" : g.data ? "AWAKE" : g.isPending ? "…" : "ASLEEP";
  const tone = status === "INSCRIBED" ? "border-signal text-signal" : status === "AWAKE" ? "border-signal/60 text-signal" : "border-bitcoin/60 text-bitcoin";
  return (
    <li className={`flex items-center gap-3 border p-2 ${current ? "border-bitcoin" : "border-border"}`}>
      <div className="size-12 shrink-0 border border-border"><GuardianPortrait height={h} size={48} /></div>
      <div className="min-w-0 flex-1 font-mono text-[10px]">
        <p className="flex items-center justify-between gap-2 text-foreground">{h}.BITMAP<span className={`border px-1 text-[9px] ${tone}`}>{status}</span></p>
        <RarityLine height={h} />
        {id ? (
          <a href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="text-signal underline">◆ VIEW ON CHAIN ↗</a>
        ) : g.data ? (
          <button type="button" onClick={() => onPick(h)} className="text-bitcoin underline hover:text-foreground">◆ INSCRIBE →</button>
        ) : g.isPending ? null : (
          <button type="button" onClick={() => onAwaken(h)} className="text-bitcoin underline hover:text-foreground">⚡ AWAKEN · {GUARDIAN_PRICE_SATS.toLocaleString()} SATS</button>
        )}
      </div>
    </li>
  );
}
