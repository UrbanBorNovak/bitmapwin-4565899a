import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { walletQuery } from "@/lib/wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { allGuardiansQuery, guardianDnaQuery } from "@/lib/bitmon-queries";
import { RARITY_TONE, type GuardianRarity } from "@/lib/bitmon";
import { morphFromDna } from "@/lib/creature-morph";
import { powerScore } from "@/lib/onchain-guardian";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";

const RANK: Record<GuardianRarity, number> = { MYTHIC: 3, EPIC: 2, RARE: 1, COMMON: 0 };
const FILTERS = ["ALL", "MYTHIC", "EPIC", "RARE", "UNAWAKENED"] as const;
const PAGE = 24;

/**
 * Previews the Guardian of every BITMAP held by the connected wallet. DNA is
 * read from public block data, so nothing is paid or summoned to look.
 */
export function GuardianScout() {
  const wallet = useWalletSession();
  const ordinals = wallet?.ordinalsAddress ?? "";
  const snapshot = useQuery({ ...walletQuery(ordinals), enabled: ordinals !== "" });
  const awake = useQuery(allGuardiansQuery());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [sort, setSort] = useState<"rarity" | "power" | "height">("rarity");
  const [page, setPage] = useState(0);

  const heights = useMemo(() => {
    const set = new Set<number>();
    for (const u of snapshot.data?.utxos ?? []) for (const i of u.inscriptions) if (i.bitmapHeight !== null) set.add(i.bitmapHeight);
    return [...set].sort((a, b) => a - b);
  }, [snapshot.data]);

  const dnas = useQueries({ queries: heights.map((h) => guardianDnaQuery(h)) });
  const awakeBy = useMemo(() => new Map((awake.data ?? []).map((g) => [g.height, g])), [awake.data]);

  const rows = useMemo(() => {
    const list = dnas.flatMap((q) => (q.data ? [{ dna: q.data, power: powerScore(q.data) }] : []));
    const filtered = list.filter(({ dna }) =>
      filter === "ALL" ? true : filter === "UNAWAKENED" ? !awakeBy.has(dna.height) : dna.rarity === filter);
    return filtered.sort((a, b) =>
      sort === "height" ? a.dna.height - b.dna.height
        : sort === "power" ? b.power - a.power
          : RANK[b.dna.rarity] - RANK[a.dna.rarity] || b.power - a.power);
  }, [dnas, filter, sort, awakeBy]);

  const loaded = dnas.filter((q) => q.data).length;
  const counts = useMemo(() => {
    const c: Record<GuardianRarity, number> = { MYTHIC: 0, EPIC: 0, RARE: 0, COMMON: 0 };
    for (const q of dnas) if (q.data) c[q.data.rarity] += 1;
    return c;
  }, [dnas]);

  if (!wallet) {
    return <p className="panel mt-4 rounded-md border border-border p-4 font-mono text-[11px] text-muted-foreground">&gt; CONNECT YOUR WALLET TO PREVIEW THE GUARDIAN OF EVERY BITMAP YOU HOLD.</p>;
  }

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const p = Math.min(page, pages - 1);

  return (
    <section className="panel mt-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="label text-signal">GUARDIAN SCOUT</p>
        <span className="font-mono text-[11px] text-muted-foreground">
          {snapshot.isLoading ? "READING WALLET…" : `${loaded}/${heights.length} BITMAPS READ`}
        </span>
        {(["MYTHIC", "EPIC", "RARE", "COMMON"] as const).map((r) => (
          <span key={r} className={`font-mono text-[11px] ${RARITY_TONE[r]}`}>{counts[r]} {r}</span>
        ))}
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">PREVIEW ONLY · TRAITS ARE READ FROM EACH BLOCK, NOTHING IS PAID UNTIL YOU AWAKEN OR INSCRIBE.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "btn-term !px-2 !py-1" : "btn-term-ghost !px-2 !py-1"} onClick={() => { setFilter(f); setPage(0); }}>{f}</button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort"
          className="ml-auto border border-border bg-background px-2 py-1 font-mono text-[11px]">
          <option value="rarity">RAREST FIRST</option>
          <option value="power">HIGHEST POWER</option>
          <option value="height">BLOCK HEIGHT</option>
        </select>
      </div>

      {heights.length === 0 && !snapshot.isLoading ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">&gt; NO BITMAPS FOUND IN THIS WALLET</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {rows.slice(p * PAGE, p * PAGE + PAGE).map(({ dna, power }) => {
            const g = awakeBy.get(dna.height);
            return (
              <div key={dna.height} className="flex gap-3 border border-border p-2">
                <GuardianPortrait height={dna.height} dna={dna} size={64} />
                <div className="min-w-0 font-mono text-[10px]">
                  <p className={RARITY_TONE[dna.rarity]}>{dna.rarity} · POWER {power}</p>
                  <p className="truncate text-foreground">{morphFromDna(dna).name}</p>
                  <p className="text-muted-foreground">{dna.species}</p>
                  <p className="text-bitcoin">{dna.height}.BITMAP</p>
                  {g?.inscriptionId ? <p className="text-signal">◆ INSCRIBED</p>
                    : g ? <Link to="/mint" search={{ height: dna.height }} className="text-signal underline">AWAKE · INSCRIBE →</Link>
                      : <Link to="/mint" search={{ height: dna.height }} className="text-bitcoin underline">AWAKEN →</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <button className="btn-term-ghost !px-3 !py-1" disabled={p === 0} onClick={() => setPage(p - 1)}>[ PREV ]</button>
          <span className="label">PAGE {p + 1} / {pages}</span>
          <button className="btn-term-ghost !px-3 !py-1" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>[ NEXT ]</button>
        </div>
      )}
    </section>
  );
}
