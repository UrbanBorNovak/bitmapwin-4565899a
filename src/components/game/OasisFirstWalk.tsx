import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useStandingLand } from "@/lib/land-biome-live";

const SEEN_KEY = "bitmapwin:oasis-first-walk-done";

/** Famous blocks worth a first visit. Heights are fixed Bitcoin history. */
export const FIRST_WALK_LANDMARKS: { height: number; label: string }[] = [
  { height: 0, label: "Genesis" },
  { height: 170, label: "First payment" },
  { height: 57043, label: "Pizza day" },
  { height: 840000, label: "4th halving" },
];

/** Small first-visit guide: where you stand, three steps, landmark jumps. */
export function OasisFirstWalk() {
  const { height } = useStandingLand();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);
  if (!open) return null;
  const close = () => {
    window.localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  };
  return (
    <section aria-label="First walk guide" className="hud-panel border-x border-t border-border font-mono text-[11px]">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="label text-signal">FIRST WALK</span>
        <button type="button" onClick={close} aria-label="Close guide" className="grid size-8 place-items-center text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-3 py-2">
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <p className="text-foreground">
            You are standing on <span className="text-bitcoin">{height.toLocaleString("en-US")}.bitmap</span>, the land of Bitcoin block #{height.toLocaleString("en-US")}. Anyone can look it up.
          </p>
          <ol className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
            <li><span className="text-signal">1</span> Walk around · no wallet needed</li>
            <li><span className="text-signal">2</span> Click a BITMAP to see its record</li>
            <li><span className="text-signal">3</span> Own, build or trade when you want</li>
          </ol>
        </div>
        <div className="min-w-[14rem]">
          <div className="label mb-1 text-muted-foreground">JUMP TO A FAMOUS BLOCK</div>
          <div className="grid grid-cols-4 gap-1">
            {FIRST_WALK_LANDMARKS.map((l) => (
              <Link key={l.height} to="/oasis" search={{ height: l.height }} reloadDocument className="border border-border px-2 py-1 text-foreground hover:border-signal hover:text-signal">
                {l.label}<span className="block text-[10px] text-muted-foreground">#{l.height.toLocaleString("en-US")}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex gap-1 self-end">
          <Link to="/marketplace" className="border border-border px-2 py-1.5 text-center text-bitcoin hover:border-bitcoin">OWN LAND</Link>
          <Link to="/forge" className="border border-border px-2 py-1.5 text-center text-bitcoin hover:border-bitcoin">TRY BUILDING</Link>
        </div>
      </div>
    </section>
  );
}
