import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { adrenalineStatusFn, claimAdrenalineFn, type FarmReport } from "@/lib/adrenaline.functions";
import { castSkill, classById, useOasisClass } from "@/lib/oasis-classes";

/**
 * ADRENALINE — licensed combat assist. While ON (F10) it keeps attacking the
 * nearest target and rotates your class skills off cooldown. On entry it
 * settles offline farming (server-side, materials only) and shows the report.
 */
export function AdrenalineBot() {
  const status = useServerFn(adrenalineStatusFn);
  const claim = useServerFn(claimAdrenalineFn);
  const lic = useQuery({ queryKey: ["adrenaline"], queryFn: () => status(), retry: false, staleTime: 60_000 });
  const licensed = !!lic.data?.licensed;
  const [on, setOn] = useState(false);
  const [report, setReport] = useState<FarmReport | null>(null);
  const cls = classById(useOasisClass() ?? "miner");
  const clsRef = useRef(cls);
  clsRef.current = cls;

  // Settle offline farm on entry, then keep the clock fresh while you play.
  useEffect(() => {
    if (!licensed) return;
    void claim().then((r) => { if (r.ok && (r.kills ?? 0) > 0) setReport(r); }).catch(() => {});
    const t = window.setInterval(() => void claim().catch(() => {}), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [licensed, claim]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "F10" && licensed) { e.preventDefault(); setOn((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [licensed]);

  useEffect(() => {
    if (!on) return;
    const ready: number[] = [];
    const t = window.setInterval(() => {
      window.dispatchEvent(new Event("oasis:attack"));
      const now = performance.now();
      (clsRef.current?.skills ?? []).slice(0, 3).forEach((s, i) => {
        if (now < (ready[i] ?? 0)) return;
        ready[i] = now + s.cooldown * 1000 + 250;
        castSkill(s);
      });
    }, 700);
    return () => window.clearInterval(t);
  }, [on]);

  if (!lic.data) return null;
  return (
    <div data-no-translate data-embed-pad className="pointer-events-auto absolute right-3 top-[5.5rem] z-[90] flex flex-col items-end gap-1 font-mono text-[10px]">
      {licensed ? (
        <button type="button" onClick={() => setOn((v) => !v)} title="Adrenaline combat assist (F10)"
          className={`hud-panel flex items-center gap-1 px-2 py-1 ${on ? "text-bitcoin" : "text-signal"} hover:text-bitcoin`}>
          <Bot className="size-3" /> ADRENALINE · {on ? "ASSIST ON" : "OFF"} · F10
        </button>
      ) : (
        <Link to="/extenders/adrenaline" className="hud-panel flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-bitcoin">
          <Bot className="size-3" /> GET ADRENALINE
        </Link>
      )}
      {report ? (
        <div className="hud-panel w-56 p-2 text-[10px]">
          <p className="text-bitcoin">ADRENALINE · WHILE YOU WERE AWAY</p>
          <p className="mt-1 text-muted-foreground">{report.hours}H FARMED · {report.kills} HUNTS</p>
          <p className="mt-1 text-foreground">
            {Object.entries(report.loot ?? {}).map(([k, n]) => `+${n} ${k.toUpperCase()}`).join(" · ")}
          </p>
          <p className="mt-1 text-[9px] text-muted-foreground">ADDED TO YOUR BLOCK BAG</p>
          <button type="button" onClick={() => setReport(null)} className="mt-1 border border-border px-2 py-0.5 text-signal hover:border-bitcoin">OK</button>
        </div>
      ) : null}
    </div>
  );
}
