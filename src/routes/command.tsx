import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { myGuardiansQuery } from "@/lib/bitmon-queries";
import { liveDispatchesQuery } from "@/lib/guardian-dispatch-queries";
import { DIRECTIVES, MAX_RANGE, positionAt, type Directive, type Dispatch } from "@/lib/guardian-dispatch";
import { deployGuardianFn, recallGuardianFn } from "@/lib/guardian-dispatch.functions";

export const Route = createFileRoute("/command")({
  head: () => ({
    meta: [
      { title: "Guardian Command Centre — BITMAPWIN" },
      { name: "description", content: "Command your Guardians from above: send them on patrols, marches and auto-farm loops that every player sees walking through the Oasis." },
      { property: "og:title", content: "Guardian Command Centre — BITMAPWIN" },
      { property: "og:description", content: "Deploy your Guardians across the Oasis. Every route is shared live with all players." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommandPage,
});

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function status(d: Dispatch | undefined, now: number) {
  if (!d) return "AT HOME";
  const left = Math.max(0, Math.ceil((d.endMs - now) / 1000));
  const p = positionAt(d.waypoints, d.startMs, d.endMs, now);
  const label = d.directive === "march" ? (p.leg === 0 ? "MARCHING OUT" : p.leg === 1 ? "HOLDING TARGET" : "RETURNING") : d.directive === "patrol" ? "ON PATROL" : "FARMING";
  return `${label} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} LEFT`;
}

function CommandPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUserId(data.user?.id ?? null); setReady(true); });
  }, []);
  const mine = useQuery(myGuardiansQuery(userId));
  const live = useQuery(liveDispatchesQuery());
  const qc = useQueryClient();
  const deploy = useServerFn(deployGuardianFn);
  const recall = useServerFn(recallGuardianFn);
  const now = useNow();
  const [directive, setDirective] = useState<Record<number, Directive>>({});
  const [target, setTarget] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const byHeight = new Map((live.data ?? []).map((d) => [d.height, d]));

  async function send(h: number) {
    const dir = directive[h] ?? "patrol";
    const t = dir === "march" ? Number(target[h]) : null;
    if (dir === "march" && !Number.isInteger(t)) { toast.error("ENTER A TARGET BLOCK HEIGHT"); return; }
    setBusy(h);
    try {
      const r = await deploy({ data: { height: h, directive: dir, target: t } });
      if (!r.ok) toast.error(r.error);
      else toast.success(`${h}.BITMAP GUARDIAN DEPLOYED · ${Math.ceil(r.seconds / 60)} MIN ROUTE — VISIBLE TO EVERY PLAYER IN THE OASIS`);
      await qc.invalidateQueries({ queryKey: ["guardian-dispatches"] });
    } finally { setBusy(null); }
  }
  async function pull(h: number) {
    setBusy(h);
    try { await recall({ data: { height: h } }); await qc.invalidateQueries({ queryKey: ["guardian-dispatches"] }); }
    finally { setBusy(null); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 font-mono">
      <p className="text-[10px] tracking-[0.3em] text-signal">COMMAND CENTRE</p>
      <h1 className="mt-2 font-display text-3xl text-foreground">Command your Guardians</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Play in the Oasis yourself, or give orders from here and let your Guardians walk the world for you. Every route is shared — other players see your Guardian moving across the map in real time.
      </p>
      <div className="mt-4 flex gap-3 text-xs">
        <Link to="/oasis" className="border border-bitcoin px-3 py-1.5 text-bitcoin hover:bg-bitcoin/10">ENTER THE OASIS →</Link>
        <span className="py-1.5 text-muted-foreground">{live.data?.length ?? 0} GUARDIANS DEPLOYED WORLDWIDE</span>
      </div>

      {ready && !userId && (
        <p className="mt-8 border border-border p-4 text-sm text-muted-foreground">Sign in with the account that summoned your Guardians to command them.</p>
      )}
      {userId && mine.data?.length === 0 && (
        <p className="mt-8 border border-border p-4 text-sm text-muted-foreground">
          This account hasn't summoned a Guardian yet. <Link to="/mint" className="text-bitcoin">Summon one →</Link>
        </p>
      )}

      <div className="mt-8 grid gap-3">
        {(mine.data ?? []).map((g) => {
          const d = byHeight.get(g.height);
          const dir = directive[g.height] ?? "patrol";
          return (
            <section key={g.height} className="border border-border bg-card/40 p-4 backdrop-blur">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-bitcoin">{g.height}.BITMAP</span>
                  <span className="ml-2 text-xs text-muted-foreground">{g.species} · LV {g.level} · SPD {g.speed} · BITE {g.bite} · ARM {g.armor}</span>
                </div>
                <span className={`text-[11px] ${d ? "text-signal" : "text-muted-foreground"}`}>{status(d, now)}</span>
              </div>
              {d ? (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1 flex-1 bg-border">
                    <div className="h-1 bg-signal" style={{ width: `${Math.round(positionAt(d.waypoints, d.startMs, d.endMs, now).progress * 100)}%` }} />
                  </div>
                  <button disabled={busy === g.height} onClick={() => pull(g.height)} className="border border-border px-3 py-1 text-xs hover:border-bitcoin">RECALL</button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {DIRECTIVES.map((o) => (
                    <button key={o.id} title={o.note} onClick={() => setDirective((s) => ({ ...s, [g.height]: o.id }))}
                      className={`border px-3 py-1 text-xs ${dir === o.id ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>
                      {o.label}
                    </button>
                  ))}
                  {dir === "march" && (
                    <input value={target[g.height] ?? ""} onChange={(e) => setTarget((s) => ({ ...s, [g.height]: e.target.value.replace(/\D/g, "") }))}
                      placeholder={`TARGET BLOCK (≤${MAX_RANGE} AWAY)`} className="w-48 border border-border bg-background px-2 py-1 text-xs" />
                  )}
                  <button disabled={busy === g.height} onClick={() => send(g.height)} className="ml-auto border border-bitcoin px-3 py-1 text-xs text-bitcoin hover:bg-bitcoin/10">DEPLOY</button>
                </div>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">{DIRECTIVES.find((o) => o.id === dir)?.note}</p>
            </section>
          );
        })}
      </div>
    </main>
  );
}
