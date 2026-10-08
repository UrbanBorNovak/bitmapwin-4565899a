import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuthSession } from "@/lib/auth";
import { AURA_POOL, AURA_WAGERS, oddsFor, type AuraTier } from "@/lib/aura-chamber";
import { myAurasFn, rollAuraFn } from "@/lib/aura-chamber.functions";
import { MUTATIONS, writeSeasonOverride, type MutationId } from "@/lib/guardian-mutations";

const REEL: MutationId[] = [...AURA_POOL.RARE, ...AURA_POOL.EPIC, ...AURA_POOL.LEGENDARY, "NONE"];
const TONE: Record<AuraTier, string> = { FIZZLE: "text-muted-foreground", RARE: "text-signal", EPIC: "text-foreground", LEGENDARY: "text-bitcoin" };

/** Mutation Chamber: wager BIT for a purely cosmetic aura. Server pays + rolls; equipping is device-local. */
export function AuraChamber({ height }: { height: number }) {
  const { session } = useAuthSession();
  const qc = useQueryClient();
  const roll = useServerFn(rollAuraFn);
  const [wager, setWager] = useState<number>(AURA_WAGERS[0]);
  const [spinning, setSpinning] = useState(false);
  const [face, setFace] = useState<MutationId>("NONE");
  const [result, setResult] = useState<{ tier: AuraTier; aura: MutationId } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mine = useQuery({ queryKey: ["my-auras"], queryFn: () => myAurasFn(), enabled: Boolean(session) });
  const odds = oddsFor(wager);

  const spin = async () => {
    setErr(null); setResult(null); setSpinning(true);
    let i = 0;
    const t = window.setInterval(() => setFace(REEL[i++ % REEL.length]!), 90);
    const started = Date.now();
    const r = await roll({ data: { height, wager } }).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : "ROLL FAILED" }) as const);
    await new Promise((res) => setTimeout(res, Math.max(0, 1800 - (Date.now() - started))));
    window.clearInterval(t);
    setSpinning(false);
    if (!r.ok || !("tier" in r) || !r.tier) { setFace("NONE"); setErr(r.error ?? "ROLL FAILED"); return; }
    const aura = (r.aura ?? "NONE") as MutationId;
    setFace(aura);
    setResult({ tier: r.tier, aura });
    qc.invalidateQueries({ queryKey: ["my-auras"] });
  };

  return (
    <section className="panel mt-6 rounded-md border border-border p-4" aria-label="Aura Mutation Chamber">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label text-signal">MUTATION CHAMBER · COSMETIC AURA ROLL</p>
        <span className="font-mono text-[10px] text-muted-foreground">LOOKS ONLY · NEVER CHANGES STATS</span>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_260px]">
        <div className={`grid h-32 place-items-center rounded-sm border bg-background ${spinning ? "animate-pulse border-bitcoin" : "border-border"}`}>
          <div className="text-center font-mono">
            <p className="text-2xl" style={{ color: MUTATIONS[face].color }}>{face === "NONE" ? (result ? "✕ FIZZLE" : "? ? ?") : MUTATIONS[face].label}</p>
            {result ? <p className={`mt-1 text-[11px] ${TONE[result.tier]}`}>{result.tier}{result.tier === "LEGENDARY" ? " · JACKPOT" : ""}</p> : null}
            {result && result.aura !== "NONE" ? (
              <button type="button" className="mt-2 text-[11px] text-bitcoin underline" onClick={() => writeSeasonOverride(result.aura)}>EQUIP ON THIS DEVICE</button>
            ) : null}
          </div>
        </div>
        <div className="space-y-2 font-mono text-[11px]">
          <div className="flex gap-1">
            {AURA_WAGERS.map((w) => (
              <button key={w} type="button" onClick={() => setWager(w)} className={wager === w ? "btn-term flex-1" : "btn-term-ghost flex-1"}>{w} BIT</button>
            ))}
          </div>
          <ul className="space-y-0.5 text-[10px]">
            <li className="flex justify-between"><span className="text-muted-foreground">FIZZLE</span><span>{odds[0]}%</span></li>
            <li className="flex justify-between"><span className="text-signal">RARE · CRYO / WRAITHFIRE</span><span>{odds[1]}%</span></li>
            <li className="flex justify-between"><span>EPIC · GENESIS / BLOOD-FURY</span><span>{odds[2]}%</span></li>
            <li className="flex justify-between"><span className="text-bitcoin">LEGENDARY · HALO / REACTOR</span><span>{odds[3]}%</span></li>
          </ul>
          {session ? (
            <button type="button" disabled={spinning} onClick={spin} className="btn-term w-full py-2">{spinning ? "ROLLING…" : `ROLL · ${wager} BIT`}</button>
          ) : (
            <Link to="/auth" className="btn-term-ghost block w-full py-2 text-center">SIGN IN TO ROLL</Link>
          )}
          {err ? <p className="text-destructive">{err}</p> : null}
        </div>
      </div>
      {mine.data?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px]">
          <span className="text-muted-foreground">YOUR AURAS</span>
          {mine.data.map((a, i) => (
            <button key={i} type="button" onClick={() => writeSeasonOverride(a.aura as MutationId)} className={`border border-border px-1.5 py-0.5 hover:border-bitcoin ${TONE[a.tier]}`}>
              {MUTATIONS[a.aura as MutationId]?.label ?? a.aura} · {a.height}
            </button>
          ))}
          <button type="button" onClick={() => writeSeasonOverride(null)} className="border border-border px-1.5 py-0.5 text-muted-foreground">CLEAR</button>
        </div>
      ) : null}
    </section>
  );
}
