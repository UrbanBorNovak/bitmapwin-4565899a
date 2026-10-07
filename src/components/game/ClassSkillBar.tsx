import { useEffect, useRef, useState } from "react";
import { castSkill, classById, useOasisClass } from "@/lib/oasis-classes";

/** Hotbar for the chosen class: keys 7/8/9 with cooldown sweeps. */
export function ClassSkillBar() {
  const cls = classById(useOasisClass() ?? "miner");
  const [ready, setReady] = useState<number[]>([0, 0, 0]);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const [, tick] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  const fire = (i: number) => {
    if (!cls) return;
    const now = performance.now();
    if (now < readyRef.current[i]!) return;
    const skill = cls.skills[i]!;
    castSkill(skill);
    setReady((r) => r.map((v, j) => (j === i ? now + skill.cooldown * 1000 : v)));
    setNote(`${skill.name} · ${skill.note}`);
    window.setTimeout(() => setNote(null), 1600);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const i = ["Digit7", "Digit8", "Digit9"].indexOf(e.code);
      if (i >= 0) fire(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!cls) return null;
  const now = performance.now();
  return (
    <div data-no-translate className="pointer-events-none absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-1">
      {note && <p className="font-mono text-xs text-bitcoin">{note}</p>}
      <div className="pointer-events-auto flex gap-1">
        {cls.skills.map((s, i) => {
          const left = Math.max(0, (ready[i]! - now) / 1000);
          return (
            <button
              key={s.name}
              onClick={() => fire(i)}
              className={`glass-panel w-24 border px-2 py-1 text-left font-mono text-[10px] ${
                left > 0 ? "border-border text-muted-foreground" : "border-bitcoin text-foreground"
              }`}
            >
              <span className="block text-signal">[{i + 7}] {left > 0 ? `${Math.ceil(left)}S` : "READY"}</span>
              <span className="block truncate">{s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
