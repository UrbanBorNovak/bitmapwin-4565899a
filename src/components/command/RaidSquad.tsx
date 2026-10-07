import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BOSS_TACTICS, GENERIC_TACTICS, SQUAD_MAX, SQUAD_ROLES, fmtCountdown, type SquadRole } from "@/lib/epic-bosses";
import { joinSquadFn, leaveSquadFn, postTacticFn, readyUpFn, squadStateFn } from "@/lib/raid-squad.functions";

export function RaidSquad({ boss, guardian, mine }: { boss: string; guardian: number | null; mine: number[] }) {
  const qc = useQueryClient();
  const key = ["raid-squad", boss];
  const squad = useQuery({ queryKey: key, queryFn: () => squadStateFn({ data: { boss } }), refetchInterval: 10_000 });
  const join = useServerFn(joinSquadFn), leave = useServerFn(leaveSquadFn), post = useServerFn(postTacticFn);
  const [role, setRole] = useState<SquadRole>("striker");
  const ready = useServerFn(readyUpFn);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const fightAt = squad.data?.fightAt ?? null;
  const left = fightAt ? fightAt - now : null;
  const readyCount = (squad.data?.members ?? []).filter((m) => m.ready).length;
  const members = squad.data?.members ?? [];
  const inSquad = guardian != null && members.some((m) => m.height === guardian);
  const anyMine = members.some((m) => mine.includes(m.height));
  const tactics = BOSS_TACTICS[boss] ?? GENERIC_TACTICS;
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  return (
    <div className="mt-3 border-t border-border pt-2 text-[10px]">
      <div className="flex items-center justify-between">
        <span className="tracking-[0.2em] text-signal">RAID SQUAD · {members.length}/{SQUAD_MAX}</span>
        <span className="text-muted-foreground">{squad.data?.total ?? 0} DMG THIS SPAWN</span>
      </div>
      <div className="mt-1 flex items-center justify-between border border-border px-2 py-1">
        <span className="tracking-[0.2em] text-muted-foreground">NEXT FIGHT</span>
        <span className={`font-display text-base ${left != null && left < 60_000 ? "animate-pulse text-bitcoin" : "text-signal"}`}>{left == null ? "--:--" : left <= 0 ? "NOW" : fmtCountdown(left)}</span>
        <span className="text-muted-foreground">{readyCount}/{members.length} READY</span>
      </div>
      <div className="mt-1 grid gap-0.5">
        {members.length === 0 && <p className="text-muted-foreground">No squad yet — be the first to enlist.</p>}
        {members.map((m) => (
          <div key={m.height} className="grid grid-cols-[4rem_4rem_1fr_3rem] items-center gap-2">
            <span className={mine.includes(m.height) ? "text-bitcoin" : "text-foreground"}>#{m.height}{m.ready ? " ✅" : ""}</span>
            <span className="text-muted-foreground">{m.role.toUpperCase()}</span>
            <div className="h-1 bg-muted"><div className="h-full bg-signal" style={{ width: `${Math.round(m.share * 100)}%` }} /></div>
            <span className="text-right text-foreground">{m.damage}</span>
          </div>
        ))}
      </div>
      {guardian != null && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {!inSquad ? (
            <>
              {SQUAD_ROLES.map((r) => (
                <button key={r.id} title={r.hint} onClick={() => setRole(r.id)}
                  className={`border px-1.5 py-0.5 ${role === r.id ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>{r.label}</button>
              ))}
              <button className="border border-bitcoin px-2 py-0.5 text-bitcoin hover:bg-bitcoin/10"
                onClick={async () => { const r = await join({ data: { boss, height: guardian, role } }); if (!r.ok) toast.error(r.error); refresh(); }}>
                JOIN WITH #{guardian}
              </button>
            </>
          ) : (
            <>
            <button className="border border-signal px-2 py-0.5 text-signal hover:bg-signal/10"
              onClick={async () => { const r = await ready({ data: { boss, height: guardian } }); r.ok ? toast.success("Ready call sent to chat") : toast.error(r.error); refresh(); }}>✅ READY UP</button>
            <button className="border border-border px-2 py-0.5 text-muted-foreground hover:text-bitcoin"
              onClick={async () => { await leave({ data: { height: guardian } }); refresh(); }}>LEAVE SQUAD</button>
            </>
          )}
        </div>
      )}
      {anyMine && <TacticComposer boss={boss} presets={tactics} send={async (p) => {
        const r = await post({ data: { boss, ...p } });
        r.ok ? toast.success("Tactic sent to chat") : toast.error(r.error);
      }} />}
    </div>
  );
}

/** Player-written raid calls, saved on this device per boss; editable and removable. */
function TacticComposer({ boss, presets, send }: {
  boss: string;
  presets: readonly string[];
  send: (p: { text?: string; index?: number }) => Promise<void>;
}) {
  const store = `raid-tactics:${boss}`;
  const [mine, setMine] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  useEffect(() => {
    try { setMine(JSON.parse(localStorage.getItem(store) ?? "[]")); } catch { setMine([]); }
  }, [store]);
  const save = (list: string[]) => { setMine(list); localStorage.setItem(store, JSON.stringify(list.slice(0, 12))); };
  const commit = () => {
    const t = draft.trim().slice(0, 140);
    if (t.length < 2) return;
    if (editing != null) save(mine.map((m, i) => (i === editing ? t : m)));
    else save([...mine, t]);
    setDraft(""); setEditing(null);
  };
  return (
    <div className="mt-2 grid gap-1">
      <span className="tracking-[0.2em] text-muted-foreground">YOUR TACTICS → WORLD CHAT</span>
      <div className="flex gap-1">
        <input value={draft} maxLength={140} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commit(); }}
          placeholder={editing != null ? "Edit tactic…" : "Write a tactic, e.g. Tanks pull left, burn on 3"}
          className="min-w-0 flex-1 border border-border bg-background px-2 py-1 text-foreground outline-none focus:border-signal" />
        <button onClick={commit} className="border border-signal px-2 text-signal hover:bg-signal/10">{editing != null ? "SAVE" : "ADD"}</button>
        <button disabled={draft.trim().length < 2} onClick={() => void send({ text: draft.trim() })}
          className="border border-bitcoin px-2 text-bitcoin hover:bg-bitcoin/10 disabled:opacity-40">SEND</button>
        {editing != null && <button onClick={() => { setEditing(null); setDraft(""); }} className="border border-border px-2 text-muted-foreground">✕</button>}
      </div>
      {mine.map((t, i) => (
        <div key={i} className="flex items-center gap-1">
          <button onClick={() => void send({ text: t })}
            className="flex-1 border border-border px-2 py-0.5 text-left text-foreground hover:border-signal hover:text-signal">{t}</button>
          <button title="Edit" onClick={() => { setEditing(i); setDraft(t); }} className="border border-border px-1.5 py-0.5 text-muted-foreground hover:text-signal">✎</button>
          <button title="Delete" onClick={() => save(mine.filter((_, j) => j !== i))} className="border border-border px-1.5 py-0.5 text-muted-foreground hover:text-destructive">🗑</button>
        </div>
      ))}
      <details className="mt-1">
        <summary className="cursor-pointer text-muted-foreground">QUICK CALLS</summary>
        <div className="mt-1 grid gap-0.5">
          {presets.map((t, i) => (
            <div key={t} className="flex gap-1">
              <button onClick={() => void send({ index: i })}
                className="flex-1 border border-border px-2 py-0.5 text-left text-foreground hover:border-signal hover:text-signal">{t}</button>
              <button title="Copy to edit" onClick={() => { setEditing(null); setDraft(t); }} className="border border-border px-1.5 text-muted-foreground hover:text-signal">✎</button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
