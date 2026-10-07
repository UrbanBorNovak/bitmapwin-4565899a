import { useEffect, useState } from "react";
import { aimState } from "@/lib/world-aim";

/** First-person reticle: tightens while aiming, flashes an X hit-marker on hits. */
export function FpsCrosshair() {
  const [hit, setHit] = useState<null | "hit" | "kill">(null);
  const [aim, setAim] = useState(0);
  useEffect(() => {
    let t = 0;
    const on = (e: Event) => {
      setHit((e as CustomEvent<{ kill?: boolean }>).detail?.kill ? "kill" : "hit");
      window.clearTimeout(t);
      t = window.setTimeout(() => setHit(null), 220);
    };
    window.addEventListener("oasis:hitmark", on);
    const i = window.setInterval(() => setAim(Math.round(aimState.amount * 10) / 10), 80);
    return () => {
      window.removeEventListener("oasis:hitmark", on);
      window.clearInterval(i);
      window.clearTimeout(t);
    };
  }, []);
  const gap = 6 - aim * 4;
  const arm = "absolute bg-signal/85";
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-20 size-0">
      <span className={arm} style={{ left: -0.5, top: -gap - 7, width: 1, height: 7 }} />
      <span className={arm} style={{ left: -0.5, top: gap, width: 1, height: 7 }} />
      <span className={arm} style={{ top: -0.5, left: -gap - 7, height: 1, width: 7 }} />
      <span className={arm} style={{ top: -0.5, left: gap, height: 1, width: 7 }} />
      <span className="absolute -left-[2px] -top-[2px] size-1 rounded-full bg-bitcoin" />
      {hit ? (
        <span className={`absolute -left-3 -top-3 grid size-6 place-items-center font-mono text-lg leading-none ${hit === "kill" ? "text-destructive" : "text-foreground"}`}>
          ✕
        </span>
      ) : null}
    </div>
  );
}
