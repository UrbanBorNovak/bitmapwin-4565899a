/** Wrist gear locker for Biternam rooms: salvaged on-chain parts, combine two to craft. */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GEAR_EVENT, GEAR_ITEMS, RECIPES, ROOM_EXHIBITS, combine, gearStore, recipeFor, useGear } from "@/lib/biternam-gear";
import { playSfx } from "@/lib/retro-sfx";

export function GearLocker() {
  const g = useGear();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setToast((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setToast(null), 4000); };
    window.addEventListener(GEAR_EVENT, on);
    return () => { window.removeEventListener(GEAR_EVENT, on); clearTimeout(t); };
  }, []);
  const toggle = (id: string) => { playSfx("verb"); setPick((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]); };
  const doCombine = () => {
    const [a, b] = pick;
    const next = a && b ? combine(g, a, b) : null;
    if (!next) { playSfx("deny"); setToast("Those two don't fit together."); return; }
    gearStore.set(next); setPick([]); playSfx("dance");
    setToast(`Crafted ${GEAR_ITEMS[recipeFor(a!, b!)!.out]!.name}!`);
  };
  const found = new Set([...g.inv]);
  const known = RECIPES.filter((r) => found.has(r.a) || found.has(r.b));
  return (
    <>
      {toast ? <div className="pointer-events-none fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded border border-primary bg-card/95 px-3 py-2 font-mono text-[12px] text-foreground">{toast}</div> : null}
      <button type="button" onClick={() => { playSfx("door"); setOpen((o) => !o); }}
        className="fixed left-4 top-56 z-[55] rounded border border-primary bg-card/90 px-3 py-1.5 font-mono text-[12px] tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">
        [ GEAR · {g.inv.length} ]
      </button>
      {open ? (
        <div className="fixed left-4 top-[17rem] z-[55] max-h-[50vh] overflow-auto w-[min(22rem,calc(100vw-2rem))] rounded border border-border bg-card/95 p-3 font-mono text-[12px]">
          <div className="flex items-center justify-between"><span className="tracking-[0.3em] text-signal">GEAR LOCKER</span><span className="text-muted-foreground">{g.salvaged.length}/{Object.keys(ROOM_EXHIBITS).length} ROOMS</span></div>
          <p className="mt-1 text-muted-foreground">Click the on-chain ride in each room to salvage a part. Pick two parts, then combine.</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {g.inv.length === 0 ? <div className="col-span-2 text-muted-foreground">Empty.</div> : g.inv.map((id) => (
              <button key={id} type="button" title={GEAR_ITEMS[id]?.blurb} onClick={() => toggle(id)}
                className={`rounded border px-2 py-1.5 text-left ${pick.includes(id) ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-signal"}`}>
                <span className="mr-1">{GEAR_ITEMS[id]?.icon}</span>{GEAR_ITEMS[id]?.name}
              </button>
            ))}
          </div>
          <button type="button" disabled={pick.length < 2} onClick={doCombine}
            className="mt-2 w-full rounded border border-primary px-2 py-1.5 tracking-widest text-primary enabled:hover:bg-primary enabled:hover:text-primary-foreground disabled:opacity-40">[ COMBINE ]</button>
          {known.length ? (
            <div className="mt-2 border-t border-border pt-2 text-muted-foreground">
              <div className="text-signal">CLUES</div>
              {known.map((r) => <div key={r.out}>{GEAR_ITEMS[r.a]!.name} + {GEAR_ITEMS[r.b]!.name} → ?</div>)}
            </div>
          ) : null}
          {g.inv.includes("hover-skiff") ? <div className="mt-2 text-primary">★ The hover-skiff is rebuilt. Wierdamoto owes you one.</div> : null}
          <Link to="/oasis" className="mt-2 inline-block text-signal hover:underline">← BACK TO THE OASIS</Link>
        </div>
      ) : null}
    </>
  );
}
