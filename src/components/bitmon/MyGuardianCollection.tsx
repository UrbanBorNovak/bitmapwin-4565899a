import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { getGuardianChildrenFn } from "@/lib/guardian-market.functions";
import { useWalletSession, walletControls } from "@/lib/wallet-session";
import { RARITY_TONE } from "@/lib/bitmon";
import { GuardianTurntable } from "@/components/bitmon/SummonGuardianDialog";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

/**
 * Personal collection dashboard: the connected wallet's Guardians, live
 * awake-vs-inscribed counts, and the on-chain inscription of each.
 */
export function MyGuardianCollection() {
  const wallet = useWalletSession();
  const roster = useQuery({ ...allGuardiansQuery(), refetchInterval: 20_000 });
  const children = useQuery({
    queryKey: ["guardian-children-v6"],
    queryFn: () => getGuardianChildrenFn(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const onChain = useMemo(() => new Set(children.data?.ids ?? []), [children.data]);
  const mine = useMemo(
    () => (roster.data ?? []).filter((g) => walletControls(wallet, g.owner)),
    [roster.data, wallet],
  );
  const inscribed = mine.filter((g) => g.inscriptionId && onChain.has(g.inscriptionId));
  const awakeOnly = mine.filter((g) => !g.inscriptionId || !onChain.has(g.inscriptionId));

  if (!wallet) {
    return (
      <section className="mt-8 border border-border bg-card/60 p-4 backdrop-blur" aria-label="Your collection">
        <p className="label text-bitcoin">MY COLLECTION</p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          CONNECT YOUR WALLET TO SEE YOUR GUARDIANS — AWAKE IN THE OASIS AND INSCRIBED ON-CHAIN.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 border border-border bg-card/60 p-4 backdrop-blur" aria-label="Your collection">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="label text-bitcoin">MY COLLECTION</p>
        <span className="font-mono text-[11px] text-signal">
          {roster.isPending ? "…" : mine.length} AWAKE
        </span>
        <span className="font-mono text-[11px] text-bitcoin">
          {children.isPending ? "…" : inscribed.length} INSCRIBED ON-CHAIN
        </span>
        <span className="label ml-auto text-muted-foreground">
          {roster.isFetching || children.isFetching ? "SYNCING…" : "LIVE"}
        </span>
      </div>

      {mine.length === 0 && !roster.isPending ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          NO GUARDIANS YET —{" "}
          <Link to="/mint" className="text-bitcoin underline">SUMMON YOUR FIRST ONE →</Link>
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mine.map((g) => {
            const verified = g.inscriptionId && onChain.has(g.inscriptionId);
            return (
              <div key={g.height} className="border border-border">
                <GuardianTurntable dna={g} className="h-36" />
                <div className="space-y-1 p-2 font-mono text-[10px]">
                  <p className={RARITY_TONE[g.rarity]}>{g.rarity} · LV {g.level}</p>
                  <p className="text-foreground">{g.species}</p>
                  <Link to="/bitmap/$block" params={{ block: String(g.height) }} className="block text-bitcoin hover:underline">
                    {g.height}.BITMAP
                  </Link>
                  {verified ? (
                    <a
                      href={`https://ordinals.com/inscription/${g.inscriptionId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-signal underline"
                      data-no-translate
                    >
                      ◆ INSCRIBED · {short(g.inscriptionId!)} ↗
                    </a>
                  ) : g.inscriptionId ? (
                    <p className="text-muted-foreground">INSCRIPTION BROADCAST · AWAITING COLLECTION INDEX</p>
                  ) : (
                    <p className="text-muted-foreground">● AWAKE IN THE OASIS · NOT YET INSCRIBED</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {awakeOnly.length > 0 ? (
        <p className="label mt-3 text-muted-foreground">
          {awakeOnly.length} GUARDIAN{awakeOnly.length === 1 ? "" : "S"} AWAKE ONLY — INSCRIBE FROM THE{" "}
          <Link to="/mint" className="text-bitcoin underline">MINT PAGE</Link> TO MAKE THEM TRADABLE.
        </p>
      ) : null}
    </section>
  );
}
