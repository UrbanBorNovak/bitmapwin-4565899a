import { useEffect, useRef, useState } from "react";
import { castSkill, classById, useOasisClass } from "@/lib/oasis-classes";
import { touchPad } from "@/lib/touch-input";

/**
 * Lineage 2 style shortcut bar: F1–F8 slots with keybind labels and a
 * cooldown sweep. Basic actions (attack, jump, duel, view) live here too so
 * the HUD needs no separate floating buttons.
 */
type Slot = { key: string; code: string; icon: string; name: string; cd: number; run: () => void; skill?: number };

export function ClassSkillBar() {
  const cls = classById(useOasisClass() ?? "miner");
  const [ready, setReady] = useState<Record<string, number>>({});
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const [, tick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 200);
    return () => window.clearInterval(t);
  }, []);

  const skillIcons = ["✦", "⛨", "◎"];
  const slots: Slot[] = [
    { key: "F1", code: "F1", icon: "⚔", name: "Attack", cd: 0.6, run: () => window.dispatchEvent(new Event("oasis:attack")) },
    ...(cls?.skills ?? []).slice(0, 3).map((s, i) => ({
      key: `F${i + 2}`,
      code: `F${i + 2}`,
      icon: skillIcons[i] ?? "✦",
      name: s.name,
      cd: s.cooldown,
      skill: i,
      run: () => {
        castSkill(s);
        setNote(`${s.name} · ${s.note}`);
        window.setTimeout(() => setNote(null), 1600);
      },
    })),
    { key: "F5", code: "F5", icon: "⤒", name: "Jump", cd: 0.4, run: () => (touchPad.jump = true) },
    { key: "F9", code: "F9", icon: "⇥", name: "Blink", cd: 5, run: () => window.dispatchEvent(new Event("oasis:blink")) },
    {
      key: "F6", code: "F6", icon: "⚡", name: "Duel", cd: 1,
      run: () => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyG", key: "g" })),
    },
    { key: "F7", code: "F7", icon: "👁", name: "View", cd: 0.3, run: () => window.dispatchEvent(new Event("oasis:camera-toggle")) },
    {
      key: "F8", code: "F8", icon: "⛶", name: "Full", cd: 0.3,
      run: () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => {});
      },
    },
  ];
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const fire = (s: Slot) => {
    const now = performance.now();
    if (now < (readyRef.current[s.code] ?? 0)) return;
    s.run();
    setReady((r) => ({ ...r, [s.code]: now + s.cd * 1000 }));
    setFlash(s.code);
    window.setTimeout(() => setFlash((f) => (f === s.code ? null : f)), 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const legacy = ["Digit7", "Digit8", "Digit9"].indexOf(e.code);
      const s = slotsRef.current.find((x) => x.code === e.code) ?? slotsRef.current.find((x) => x.skill === legacy && legacy >= 0);
      if (!s || !e.isTrusted) return;
      e.preventDefault();
      fire(s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const now = performance.now();
  return (
    <div data-no-translate data-embed-pad className="pointer-events-none absolute bottom-3 right-3 z-[95] flex sm:right-auto sm:left-1/2 sm:-translate-x-1/2 max-w-[calc(100%-9.5rem)] sm:max-w-none flex-col items-center gap-1">
      {note && <p className="hud-panel px-2 py-0.5 font-mono text-[10px] text-bitcoin">{note}</p>}
      <div className="hud-panel pointer-events-auto flex flex-wrap justify-end gap-[3px] border-bitcoin/40 p-[3px]">
        {slots.map((s) => {
          const total = s.cd * 1000;
          const left = Math.max(0, (ready[s.code] ?? 0) - now);
          const pct = total > 0 ? (left / total) * 100 : 0;
          return (
            <button
              key={s.code}
              type="button"
              title={`${s.name} (${s.key})`}
              aria-label={`${s.name} (${s.key})`}
              onPointerDown={(e) => {
                e.preventDefault();
                fire(s);
              }}
              className={`relative grid size-9 touch-none select-none place-items-center overflow-hidden border bg-background/70 font-mono sm:size-10 ${
                s.skill !== undefined ? "border-bitcoin/60" : "border-border"
              } ${flash === s.code ? "ring-2 ring-signal" : ""}`}
            >
              <span className={`text-base leading-none ${left > 0 ? "text-muted-foreground" : "text-foreground"}`}>{s.icon}</span>
              {left > 0 ? (
                <>
                  <span
                    className="absolute inset-0 bg-background/70"
                    style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
                  />
                  <span className="absolute inset-0 grid place-items-center text-[10px] text-bitcoin">
                    {left > 1000 ? Math.ceil(left / 1000) : ""}
                  </span>
                </>
              ) : null}
              <span className="absolute left-0.5 top-0 text-[7px] text-signal">{s.key}</span>
              <span className="absolute inset-x-0 bottom-0 truncate px-0.5 text-center text-[6px] uppercase text-muted-foreground">
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
