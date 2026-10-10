import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { getGuardianChildrenFn } from "@/lib/guardian-market.functions";
import { useWalletSession, walletControls } from "@/lib/wallet-session";
import { RARITY_TONE, esploraFetch } from "@/lib/bitmon";

type TxStatus = { confirmed: boolean; block_height?: number };

/** Live per-Guardian telemetry for the connected holder: chain-confirmed block, era, level, phase and DNA stats. */
export function GuardianTracker() {
  const wallet = useWalletSession();
  const roster = useQuery({ ...allGuardiansQuery(), refetchInterval: 20_000 });
  const children = useQuery({ queryKey: ["guardian-children-v6"], queryFn: () => getGuardianChildrenFn(), staleTime: 60_000, refetchInterval: 60_000 });
  const tip = useQuery({
    queryKey: ["chain-tip-height"],
    queryFn: async () => Number(await (await esploraFetch("/blocks/tip/height")).text()) || 0,
    refetchInterval: 60_000,
  });
  const onChain = useMemo(() => new Set(children.data?.ids ?? []), [children.data]);
  const mine = useMemo(() => (roster.data ?? []).filter((g) => walletControls(wallet, g.owner)), [roster.data, wallet]);
  const txs = useQueries({
    queries: mine.map((g) => ({
      queryKey: ["guardian-summon-tx", g.txid],
      queryFn: async () => ((await (await esploraFetch(`/tx/${g.txid}/status`)).json()) as TxStatus),
      enabled: /^[0-9a-f]{64}$/.test(g.txid),
      staleTime: 120_000,
    })),
  });

  if (!wallet) return null;

  return (
    <section className="panel mt-6 rounded-md border border-border p-4" aria-label="Guardian tracker">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="label text-signal">GUARDIAN TRACKER · LIVE CHAIN TELEMETRY</p>
        <span className="font-mono text-[10px] text-muted-foreground">TIP {tip.data ? tip.data.toLocaleString() : "…"}</span>
        <span className="label ml-auto text-muted-foreground">{roster.isFetching ? "SYNCING…" : "LIVE"}</span>
      </div>
      {mine.length === 0 ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          {roster.isPending ? "> READING THE ROSTER…" : "NO AWAKENED GUARDIANS ON THIS WALLET YET."}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] font-mono text-[11px]">
            <thead>
              <tr className="label text-left text-muted-foreground">
                <th className="py-1 pr-3 font-normal">BITMAP</th>
                <th className="pr-3 font-normal">SPECIES</th>
                <th className="pr-3 font-normal">CONFIRMED BLOCK</th>
                <th className="pr-3 font-normal">ERA</th>
                <th className="pr-3 font-normal">LV</th>
                <th className="pr-3 font-normal">PHASE</th>
                <th className="pr-3 font-normal">HP</th>
                <th className="pr-3 font-normal">BITE</th>
                <th className="pr-3 font-normal">SPEED</th>
                <th className="font-normal">ARMOR</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((g, i) => {
                const st = txs[i]?.data;
                const bh = st?.block_height;
                const confs = st?.confirmed && bh && tip.data ? tip.data - bh + 1 : null;
                const inscribed = Boolean(g.inscriptionId && onChain.has(g.inscriptionId));
                return (
                  <tr key={g.height} className="border-t border-border" data-no-translate>
                    <td className="py-2 pr-3">
                      <Link to="/collections/guardians/$height" params={{ height: String(g.height) }} className="text-bitcoin hover:underline">{g.height}.BITMAP</Link>
                    </td>
                    <td className="pr-3">
                      <span className="mr-1 inline-block size-2 border border-border align-middle" style={{ background: g.body }} />
                      <span className={RARITY_TONE[g.rarity]}>{g.rarity}</span> {g.species}
                    </td>
                    <td className="pr-3">
                      {st == null ? <span className="text-muted-foreground">…</span> : st.confirmed && bh ? (
                        <a href={`https://mempool.space/tx/${g.txid}`} target="_blank" rel="noreferrer" className="text-signal underline">
                          #{bh.toLocaleString()}{confs ? ` · ${confs.toLocaleString()} CONF` : ""}
                        </a>
                      ) : <span className="text-bitcoin">MEMPOOL</span>}
                    </td>
                    <td className="pr-3">{Math.floor(g.height / 210_000)}</td>
                    <td className="pr-3">{g.level}</td>
                    <td className="pr-3">
                      {inscribed ? (
                        <a href={`https://ordinals.com/inscription/${g.inscriptionId}`} target="_blank" rel="noreferrer" className="text-bitcoin underline">INSCRIBED</a>
                      ) : <span className="text-signal">AWAKE</span>}
                      <span className="block text-[9px] text-muted-foreground">{g.ability}</span>
                    </td>
                    <td className="pr-3">{g.hp}</td>
                    <td className="pr-3">{g.bite}</td>
                    <td className="pr-3">{g.speed}</td>
                    <td>{g.armor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
