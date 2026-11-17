import { useState } from "react";
import { FEE_RECYCLING_ACTIVE } from "@/lib/fee-recycling";

type Step = { id: string; label: string; x: number; y: number; title: string; body: string; cost: string };

const STEPS: Step[] = [
  { id: "hold", label: "YOUR WALLET", x: 200, y: 60, title: "Your BITMAP never moves", body: "It stays in your own wallet. Nothing is locked, bridged or handed to anyone.", cost: "0 sats" },
  { id: "prove", label: "BIP-322 PROOF", x: 340, y: 200, title: "Prove you hold it", body: "You sign a free message. No transaction, no Bitcoin fee.", cost: "0 sats" },
  { id: "stake", label: "STAKE", x: 200, y: 340, title: "Register the stake", body: "One small Stacks network fee to record the stake. This is the only required cost.", cost: "network fee only" },
  { id: "pool", label: "REWARD POOL", x: 60, y: 200, title: "Sponsors & upgrades fill the pool", body: "Epoch sponsors and optional slab skins are planned to feed the pool; rewards flow back to stakers by weight.", cost: "paid by others" },
];

const NODES = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  return { x: 200 + Math.cos(a) * 185, y: 200 + Math.sin(a) * 185 };
});

export function CircularEconomyDiagram() {
  const [active, setActive] = useState<string>("hold");
  const step = STEPS.find((s) => s.id === active)!;
  return (
    <section className="rounded-lg border border-border bg-card/60 p-5 backdrop-blur">
      <p className="font-mono text-xs tracking-widest text-accent">THE CIRCULAR ECONOMY</p>
      <h2 className="mt-1 text-xl font-semibold text-foreground">What a staker pays, and how anyone can run their own</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1fr] items-center">
        <svg viewBox="0 0 400 400" className="w-full max-w-md mx-auto" role="img" aria-label="Circular staking economy diagram">
          {NODES.map((n, i) => (
            <g key={i}>
              <line x1={200} y1={200} x2={n.x} y2={n.y} className="stroke-border" strokeWidth={0.5} strokeDasharray="2 4" />
              <rect x={n.x - 6} y={n.y - 6} width={12} height={12} className="fill-muted stroke-accent" strokeWidth={0.8} />
            </g>
          ))}
          <circle cx={200} cy={200} r={140} fill="none" className="stroke-accent" strokeWidth={2} strokeDasharray="6 6">
            <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="30s" repeatCount="indefinite" />
          </circle>
          <text x={200} y={196} textAnchor="middle" className="fill-primary font-mono" fontSize={11}>BITMAPWIN</text>
          <text x={200} y={210} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>OPEN SOURCE</text>
          {STEPS.map((s) => (
            <g key={s.id} onClick={() => setActive(s.id)} className="cursor-pointer" role="button" aria-label={s.title}>
              <circle cx={s.x} cy={s.y} r={30} className={active === s.id ? "fill-primary" : "fill-card stroke-primary"} strokeWidth={1.5} />
              <text x={s.x} y={s.y + 3} textAnchor="middle" fontSize={7} className={active === s.id ? "fill-primary-foreground font-mono" : "fill-foreground font-mono"}>{s.label}</text>
            </g>
          ))}
        </svg>
        <div>
          <p className="font-mono text-xs text-accent">COST · {step.cost.toUpperCase()}</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
          <div className="mt-4 rounded border border-border p-3 text-sm text-muted-foreground">
            <p className="font-mono text-xs text-primary">THE OUTER SQUARES</p>
            Each square is another BITMAP community. The app is open source, so any group can run its own copy with its own sponsors and pool.
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Pilot runs on testnet only. {FEE_RECYCLING_ACTIVE ? "Fee recycling is active." : "Fee recycling is planned, not active yet."}
          </p>
        </div>
      </div>
    </section>
  );
}
