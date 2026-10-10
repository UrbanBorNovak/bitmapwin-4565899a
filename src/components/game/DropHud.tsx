import { useEffect, useState, useSyncExternalStore } from "react";
import { Plane } from "lucide-react";
import { cancelDrop, dropAction, dropRevision, dropState, planeProgress, requestDrop, subscribeDrop, DROP } from "@/lib/battle-royale";

/** Opt-in button and live drop prompts for the Battle Royale drop. */
export function DropHud() {
  useSyncExternalStore(subscribeDrop, dropRevision, () => 0);
  const st = dropState();
  const [, tick] = useState(0);
  useEffect(() => {
    if (st.phase === "idle") return;
    const id = window.setInterval(() => tick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [st.phase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === " " && dropState().phase !== "idle") dropAction();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const justLanded = st.phase === "idle" && Date.now() - st.landedAt < 4000;
  useEffect(() => {
    if (!st.landedAt) return;
    const id = window.setTimeout(() => tick((n) => n + 1), 4100);
    return () => window.clearTimeout(id);
  }, [st.landedAt]);

  const left = Math.max(0, Math.ceil(DROP.flight * (1 - planeProgress())));

  return (
    <>
      {st.phase === "idle" ? (
        <button
          type="button"
          onClick={requestDrop}
          className="hud-panel hud-keep absolute left-3 top-14 z-[85] flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-bitcoin hover:text-foreground"
        >
          <Plane className="size-3.5" /> BATTLE DROP
        </button>
      ) : null}
      {st.phase !== "idle" ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-[86] flex justify-center">
          <div className="hud-panel pointer-events-auto flex items-center gap-3 px-4 py-2 font-mono text-[11px]">
            {st.phase === "plane" ? (
              <>
                <span className="text-signal">DROPSHIP · JUMP IN {left}s</span>
                <button type="button" onClick={dropAction} className="text-bitcoin hover:text-foreground">[SPACE] JUMP</button>
              </>
            ) : st.phase === "freefall" ? (
              <>
                <span className="text-signal">FREEFALL · W TO DIVE</span>
                <button type="button" onClick={dropAction} className="text-bitcoin hover:text-foreground">[SPACE] OPEN GLIDER</button>
              </>
            ) : (
              <span className="text-signal">GLIDING · STEER TO A LANDING</span>
            )}
            <button type="button" onClick={cancelDrop} className="text-muted-foreground hover:text-foreground">CANCEL</button>
          </div>
        </div>
      ) : null}
      {justLanded ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-[86] flex justify-center">
          <div className="hud-panel px-4 py-2 font-mono text-[11px] text-bitcoin">TOUCHDOWN</div>
        </div>
      ) : null}
    </>
  );
}
