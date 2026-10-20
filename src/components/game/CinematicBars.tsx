import { useSyncExternalStore } from "react";
import { cinematics } from "@/lib/oasis-cinematics";

/** Letterbox bars + location title while a landmark shot plays. */
export function CinematicBars({ hidden }: { hidden?: boolean }) {
  const active = useSyncExternalStore(cinematics.subscribe, cinematics.active, () => null);
  if (hidden || !active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute inset-x-0 top-0 h-[11%] bg-background" />
      <div className="absolute inset-x-0 bottom-0 flex h-[11%] items-center justify-between bg-background px-6">
        <span className="font-mono text-[11px] tracking-[0.25em] text-signal">ESTABLISHING // {active.shot.title}</span>
        <button
          type="button"
          onClick={() => cinematics.stop()}
          className="pointer-events-auto font-mono text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary"
        >
          [ SKIP · WASD / SPACE / ESC ]
        </button>
      </div>
    </div>
  );
}
