import { useEffect, useState, useSyncExternalStore } from "react";
import { Plane } from "lucide-react";
import {
  alive, cancelDrop, clearResult, clock, dropAction, dropRevision, dropState, matchById, onBrEvent,
  requestDrop, setBrHooks, stormAt, subscribeDrop, MATCH, STORM_START,
} from "@/lib/battle-royale";
import { supabase } from "@/integrations/supabase/client";

const meId = () => {
  const k = "oasis-br-id";
  let v = localStorage.getItem(k);
  if (!v) { v = crypto.randomUUID().slice(0, 12); localStorage.setItem(k, v); }
  return v;
};

/** Opt-in button, live match timers, storm warnings and results. */
export function DropHud() {
  useSyncExternalStore(subscribeDrop, dropRevision, () => 0);
  const st = dropState();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  // Live roster: joins, eliminations and opened crates for everyone in the match.
  useEffect(() => {
    const ch = supabase.channel("oasis-br", { config: { broadcast: { self: false } } });
    for (const ev of ["join", "out", "crate"]) ch.on("broadcast", { event: ev }, ({ payload }) => onBrEvent(ev, payload));
    ch.subscribe();
    setBrHooks({ me: meId(), send: (event, payload) => void ch.send({ type: "broadcast", event, payload }) });
    return () => { setBrHooks({ send: () => {} }); void supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === " ") dropAction();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { id, t } = clock();
  const storm = stormAt(matchById(id), t);
  const canJoin = st.phase === "idle" && t < STORM_START;
  const nextIn = Math.ceil(MATCH.cycle - t);
  const lobbyIn = Math.ceil(MATCH.lobby - t);
  const flightLeft = Math.max(0, Math.ceil(STORM_START - t));
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  let line: string | null = null;
  if (st.phase === "queued") line = `BOARDING · PLANE LEAVES IN ${lobbyIn}s`;
  else if (st.phase === "plane") line = `DROPSHIP · JUMP IN ${flightLeft}s`;
  else if (st.phase === "freefall") line = "FREEFALL · W TO DIVE";
  else if (st.phase === "glide") line = "GLIDING · STEER TO A LANDING";
  else if (st.phase === "landed") line = storm ? `STORM ${storm.phase + 1}/${MATCH.dps.length} · ${storm.shrinking ? "CLOSING" : "SHRINKS IN"} ${storm.next}s` : "LOOT UP · STORM FORMING";

  return (
    <>
      {st.phase === "idle" ? (
        <button
          type="button"
          onClick={canJoin ? requestDrop : undefined}
          disabled={!canJoin}
          className="hud-panel hud-keep absolute left-3 top-14 z-[85] flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-bitcoin hover:text-foreground disabled:text-muted-foreground"
        >
          <Plane className="size-3.5" />
          {canJoin ? (t < MATCH.lobby ? `BATTLE DROP · ${lobbyIn}s` : "BATTLE DROP · PLANE IN AIR") : `NEXT DROP ${fmt(nextIn)}`}
        </button>
      ) : null}
      {line ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-[86] flex justify-center">
          <div className="hud-panel pointer-events-auto flex items-center gap-3 px-4 py-2 font-mono text-[11px]">
            <span className="text-signal">{line}</span>
            <span className="text-foreground">{alive()} ALIVE</span>
            {st.phase === "plane" ? <button type="button" onClick={dropAction} className="text-bitcoin hover:text-foreground">[SPACE] JUMP</button> : null}
            {st.phase === "freefall" ? <button type="button" onClick={dropAction} className="text-bitcoin hover:text-foreground">[SPACE] GLIDER</button> : null}
            <button type="button" onClick={cancelDrop} className="text-muted-foreground hover:text-foreground">LEAVE</button>
          </div>
        </div>
      ) : null}
      {st.phase === "landed" && st.outside ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-[84] shadow-[inset_0_0_120px_hsl(var(--signal)/0.55)]" />
          <div className="pointer-events-none absolute inset-x-0 top-28 z-[86] flex justify-center">
            <div className="hud-panel px-4 py-2 font-mono text-[11px] text-destructive">
              IN THE STORM · -{storm?.dps ?? 0} HP/s · {Date.now() < st.shieldUntil ? "SHIELDED" : "GET TO THE CIRCLE"}
            </div>
          </div>
        </>
      ) : null}
      {st.note ? (
        <div className="pointer-events-none absolute inset-x-0 top-28 z-[86] flex justify-center">
          <div className="hud-panel px-4 py-2 font-mono text-[11px] text-bitcoin">{st.note}</div>
        </div>
      ) : null}
      {st.result ? (
        <div className="absolute inset-x-0 top-16 z-[87] flex justify-center">
          <button type="button" onClick={clearResult} className="hud-panel px-5 py-3 font-mono text-xs text-bitcoin">
            {st.result === "victory" ? "★ LAST ONE STANDING" : st.result === "survived" ? "SURVIVED THE STORM" : "ELIMINATED"} · TAP TO CLOSE
          </button>
        </div>
      ) : null}
    </>
  );
}
