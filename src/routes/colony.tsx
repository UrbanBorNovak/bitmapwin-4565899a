import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CITIZENS, citizenAt, needsApproval, useApprovals, approvals, brokerPicks } from "@/lib/agent-colony";
import { fetchOffers } from "@/lib/offers";
import { LANDMARKS, landmarkSpot } from "@/lib/world-landmarks";

export const Route = createFileRoute("/colony")({
  head: () => ({
    meta: [
      { title: "Agent Colony · BitmapWin" },
      { name: "description", content: "Live dashboard of the Oasis agent citizens: where they are, what they're doing, and every trade or spend waiting for owner approval." },
      { property: "og:title", content: "Agent Colony · BitmapWin" },
      { property: "og:description", content: "Where every Oasis citizen is right now, and an owner approval queue for any agent trade or spend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ColonyPage,
});

function useNow() {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => { setT(Date.now() / 1000); const id = setInterval(() => setT(Date.now() / 1000), 1000); return () => clearInterval(id); }, []);
  return t;
}

function ColonyPage() {
  const t = useNow();
  const list = useApprovals();
  const pending = list.filter((p) => p.status === "pending");
  const [scan, setScan] = useState<string | null>(null);
  async function askBroker() {
    setScan("Margo is reading the live listings…");
    try {
      const offers = await fetchOffers({ limit: 100 });
      const n = approvals.proposeTrades(brokerPicks(offers.filter((o) => o.status === "open")));
      setScan(n > 0 ? `Margo proposed ${n} trade${n > 1 ? "s" : ""}. Nothing happens until you approve.` : "No new listings worth proposing right now.");
    } catch {
      setScan("Couldn't read the marketplace. Try again.");
    }
  }
  const used = new Set(CITIZENS.flatMap((c) => c.route));
  const spots = LANDMARKS.filter((l) => used.has(l.id)).map((l) => ({ l, ...landmarkSpot(l) }));
  const xs = spots.map((s) => s.x), zs = spots.map((s) => s.z);
  const pad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 0.15 + 1;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const px = (x: number) => ((x - minX) / (maxX - minX)) * 100;
  const pz = (z: number) => ((z - minZ) / (maxZ - minZ)) * 100;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header>
        <div className="font-mono text-[11px] tracking-widest text-signal">AGENT FRONTIER · LIVE</div>
        <h1 className="font-display text-3xl text-foreground">Agent Colony</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Citizens walk fixed routes between Oasis landmarks, so everyone sees them in the same place. They can walk and talk on their own. Any trade or spend waits here for the owner to approve, and an approved action only opens the normal page where you sign it yourself.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="glass-panel relative aspect-square rounded-[18px] border border-border p-2">
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-label="Colony map">
            {spots.map((s) => (
              <g key={s.l.id}>
                <rect x={px(s.x) - 1.5} y={pz(s.z) - 1.5} width={3} height={3} className="fill-muted-foreground/50" />
                <text x={px(s.x)} y={pz(s.z) - 2.5} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={2.2}>{s.l.label}</text>
              </g>
            ))}
            {t !== null && CITIZENS.map((c) => {
              const st = citizenAt(c, t);
              return <circle key={c.id} cx={px(st.x)} cy={pz(st.z)} r={1.6} fill={c.color}><title>{c.name}</title></circle>;
            })}
          </svg>
        </div>

        <div className="space-y-2">
          {CITIZENS.map((c) => {
            const st = t !== null ? citizenAt(c, t) : null;
            return (
              <div key={c.id} className="glass-panel flex items-center gap-3 rounded-[14px] border border-border p-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12px] tracking-widest text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.role} · {st ? st.activity : "locating…"}</div>
                </div>
                <span className={`font-mono text-[10px] ${st?.moving ? "text-signal" : "text-primary"}`}>{st ? (st.moving ? "MOVING" : "IDLE") : ""}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-panel rounded-[18px] border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[12px] tracking-widest text-primary">OWNER APPROVALS · {pending.length} PENDING</h2>
          <button type="button" onClick={askBroker} className="rounded border border-signal/50 px-2 py-0.5 font-mono text-[11px] text-signal">ASK BROKER FOR TRADES</button>
          <span className="font-mono text-[10px] text-muted-foreground">TRADE {needsApproval("trade") ? "NEEDS APPROVAL" : ""} · SPEND {needsApproval("spend") ? "NEEDS APPROVAL" : ""}</span>
        </div>
        {scan && <p className="mt-2 font-mono text-[11px] text-signal">{scan}</p>}
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No agent has asked to trade or spend yet. When one does, it shows up here and nothing happens until you approve it.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-sm">
                <span className="font-mono text-[11px] uppercase text-signal">{p.kind}</span>
                {p.item ? (
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground"><span className="font-mono">{p.item}</span> · <span className="font-mono text-primary">{p.priceSats?.toLocaleString()} sats</span> <span className="text-xs text-muted-foreground">+ 2% fee</span></div>
                    <div className="text-xs text-muted-foreground">Why: {p.reason}</div>
                  </div>
                ) : <span className="flex-1 text-foreground">{p.summary}</span>}
                {p.status === "pending" ? (
                  <>
                    <button type="button" onClick={() => approvals.decide(p.id, true)} className="rounded border border-primary/50 px-2 py-0.5 font-mono text-[11px] text-primary">APPROVE</button>
                    <button type="button" onClick={() => approvals.decide(p.id, false)} className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">REJECT</button>
                  </>
                ) : p.status === "approved" ? (
                  <a href={p.href} className="font-mono text-[11px] text-primary underline">OPEN & SIGN IN YOUR WALLET</a>
                ) : <span className="font-mono text-[11px] text-muted-foreground">REJECTED</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/biternam" className="font-mono text-[11px] text-signal underline">← BITERNAM</Link>
    </main>
  );
}
