import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { myGuardiansQuery, allGuardiansQuery } from "@/lib/bitmon-queries";
import { GuardianTurntable } from "@/components/bitmon/SummonGuardianDialog";
import { TargetRadar, BattleReport, combatRole } from "@/components/command/TacticalDeck";
import { liveDispatchesQuery } from "@/lib/guardian-dispatch-queries";
import { DIRECTIVES, MAX_RANGE, dispatchPosition, type Directive, type Dispatch } from "@/lib/guardian-dispatch";
import { deployGuardianFn, recallGuardianFn } from "@/lib/guardian-dispatch.functions";
import { settleRaidsFn } from "@/lib/guardian-raid.functions";
import { BossRaids } from "@/components/command/BossRaids";
import { WhileAway } from "@/components/retention/WhileAway";
import { GuardianIndex } from "@/components/command/GuardianIndex";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";
import { guardianCry, guardianTier, powerScore } from "@/lib/onchain-guardian";
import { morphFromDna } from "@/lib/creature-morph";
import { useNavigate } from "@tanstack/react-router";

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
  const p = dispatchPosition(d, now);
  const lapMs = d.endMs - d.startMs;
  const left = Math.max(0, Math.ceil((d.repeat ? lapMs - ((now - d.startMs) % lapMs) : d.endMs - now) / 1000));
  const label = d.directive === "march" ? (p.leg === 0 ? "MARCHING OUT" : p.leg === 1 ? "HOLDING TARGET" : "RETURNING") : d.directive === "patrol" ? "ON PATROL" : "FARMING";
  return `${d.repeat ? `WALKER LAP ${p.lap} · ` : ""}${label} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} ${d.repeat ? "TO NEXT LAP" : "LEFT"}`;
}

function CommandPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUserId(data.user?.id ?? null); setReady(true); });
  }, []);
  const mine = useQuery(myGuardiansQuery(userId));
  const live = useQuery(liveDispatchesQuery());
  const all = useQuery(allGuardiansQuery());
  const [view3d, setView3d] = useState<Record<number, boolean>>({});
  const qc = useQueryClient();
  const deploy = useServerFn(deployGuardianFn);
  const recall = useServerFn(recallGuardianFn);
  const now = useNow();
  const [directive, setDirective] = useState<Record<number, Directive>>({});
  const [target, setTarget] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [loop, setLoop] = useState<Record<number, boolean>>({});
  const byHeight = new Map((live.data ?? []).map((d) => [d.height, d]));
  const settle = useServerFn(settleRaidsFn);
  const raids = useQuery({
    queryKey: ["guardian-raids", "recent"],
    queryFn: async () => {
      await settle().catch(() => null);
      const [{ data: r }, { data: sp }] = await Promise.all([
        supabase.from("guardian_raids").select("id, attacker_height, defender_height, winner_height, spoils, log, resolved_at").order("resolved_at", { ascending: false }).limit(30),
        supabase.from("bitmap_spoils").select("block_height, bit, raids_won"),
      ]);
      return { raids: r ?? [], spoils: new Map((sp ?? []).map((x) => [Number(x.block_height), x])) };
    },
    refetchInterval: 15_000,
  });

  async function send(h: number) {
    const dir = directive[h] ?? "patrol";
    const t = dir === "march" ? Number(target[h]) : null;
    if (dir === "march" && !Number.isInteger(t)) { toast.error("ENTER A TARGET BLOCK HEIGHT"); return; }
    setBusy(h);
    try {
      const r = await deploy({ data: { height: h, directive: dir, target: t, repeat: loop[h] ?? true } });
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
    <main className="mx-auto max-w-5xl px-4 py-10 font-mono [background-image:linear-gradient(color-mix(in_oklab,var(--signal)_6%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--signal)_6%,transparent)_1px,transparent_1px)] [background-size:32px_32px]">
      <p className="text-[10px] tracking-[0.3em] text-signal">COMMAND CENTRE</p>
      <h1 className="mt-2 font-display text-3xl text-foreground">Command your Guardians</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Play in the Oasis yourself, or give orders from here and let your Guardians walk the world for you. Every route is shared — other players see your Guardian moving across the map in real time.
      </p>
      <div className="mt-4 flex gap-3 text-xs">
        <Link to="/oasis" className="border border-bitcoin px-3 py-1.5 text-bitcoin hover:bg-bitcoin/10">ENTER THE OASIS →</Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
        {([
          ["DEPLOYED WORLDWIDE", live.data?.length ?? 0],
          ["GUARDIANS AWAKE", all.data?.length ?? 0],
          ["YOUR GARRISON", mine.data?.length ?? 0],
          ["RAIDS SETTLED (RECENT)", raids.data?.raids.length ?? 0],
        ] as const).map(([l, v]) => (
          <div key={l} className="bg-background/80 px-4 py-3 backdrop-blur">
            <p className="text-[9px] tracking-[0.25em] text-muted-foreground">{l}</p>
            <p className="font-display text-2xl text-signal">{v}</p>
          </div>
        ))}
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
                <div className="flex items-center gap-3">
                  <GuardianPortrait dna={g} size={56} />
                  <div>
                  <span className="text-bitcoin">{g.height}.BITMAP</span>
                  <span className="ml-2 text-xs text-muted-foreground">{g.species} · LV {g.level} · {g.rarity}</span>
                  <span className="ml-2 border border-bitcoin/40 px-1.5 py-0.5 text-[9px] tracking-[0.2em] text-bitcoin">{combatRole(g)}</span>
                  <span className="ml-2 border border-signal/40 px-1.5 py-0.5 text-[9px] tracking-[0.2em] text-signal">TIER {guardianTier(g)} · PWR {powerScore(g)}</span>
                  <div className="mt-1 flex gap-2 text-[10px]">
                    <button onClick={() => setView3d((s) => ({ ...s, [g.height]: !s[g.height] }))} className="text-signal hover:underline">{view3d[g.height] ? "HIDE 3D" : "INSPECT 3D"}</button>
                    <button onClick={() => guardianCry(g.dnaHash, morphFromDna(g).plan.toLowerCase(), "roar")} className="text-bitcoin hover:underline">ROAR</button>
                    <button onClick={() => guardianCry(g.dnaHash, morphFromDna(g).plan.toLowerCase(), "strike")} className="text-bitcoin hover:underline">STRIKE</button>
                  </div>
                  </div>
                </div>
                <span className={`text-[11px] ${d ? "text-signal" : "text-muted-foreground"}`}>{status(d, now)}</span>
              </div>
              {view3d[g.height] && <GuardianTurntable dna={{ ...g, height: g.height }} className="mt-3 h-56 border border-border" />}
              <div className="mt-3 grid grid-cols-4 gap-px border border-border bg-border">
                {([
                  ["BITE", g.bite],
                  ["ARMOR", g.armor],
                  ["SPEED", g.speed],
                  ["HP", g.hp],
                ] as const).map(([label, val]) => (
                  <div key={label} className="bg-background px-3 py-2">
                    <p className="text-[9px] tracking-[0.25em] text-muted-foreground">{label}</p>
                    <p className={`font-display text-lg ${label === "BITE" ? "text-bitcoin" : "text-foreground"}`}>{val}</p>
                  </div>
                ))}
              </div>
              {d ? (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1 flex-1 bg-border">
                    <div className="h-1 bg-signal" style={{ width: `${Math.round(dispatchPosition(d, now).progress * 100)}%` }} />
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
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <input type="checkbox" checked={loop[g.height] ?? true} onChange={(e) => setLoop((s) => ({ ...s, [g.height]: e.target.checked }))} />
                    WALKER LOOP · KEEPS GOING WITH YOUR BROWSER CLOSED
                  </label>
                  <button disabled={busy === g.height} onClick={() => send(g.height)} className="ml-auto border border-bitcoin px-3 py-1 text-xs text-bitcoin hover:bg-bitcoin/10">DEPLOY</button>
                </div>
              )}
              {!d && dir === "march" && (
                <TargetRadar me={g} all={all.data ?? []} onPick={(t) => setTarget((s) => ({ ...s, [g.height]: String(t) }))} />
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                {DIRECTIVES.find((o) => o.id === dir)?.note}
                {dir === "march" && " Marching onto a BITMAP with a Guardian starts a raid — Bite, Armor and Speed decide it; spoils land on the winner's BITMAP."}
              </p>
              <p className="mt-1 text-[10px] text-bitcoin">
                SPOILS ON {g.height}.BITMAP · {Number(raids.data?.spoils.get(g.height)?.bit ?? 0)} BIT · {raids.data?.spoils.get(g.height)?.raids_won ?? 0} RAIDS WON
              </p>
            </section>
          );
        })}
      </div>

      <WhileAway raids={raids.data?.raids ?? []} mine={(mine.data ?? []).map((g) => g.height)} />
      {userId && <BossRaids guardians={mine.data ?? []} />}

      <h2 className="mt-12 text-[10px] tracking-[0.3em] text-signal">RAID LOG · LIVE</h2>
      <div className="mt-3 grid gap-2">
        {(raids.data?.raids ?? []).length === 0 && <p className="text-xs text-muted-foreground">No raids settled yet. March a Guardian onto a guarded BITMAP.</p>}
        {(raids.data?.raids ?? []).map((r) => (
          <BattleReport key={r.id} r={r} maxHp={(h) => all.data?.find((x) => x.height === h)?.hp} />
        ))}
      </div>

      <GuardianIndex guardians={all.data ?? []} onPick={(h) => navigate({ to: "/mint", search: { height: h } })} />
    </main>
  );
}
