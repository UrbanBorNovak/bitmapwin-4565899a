import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BLOCKS, RECIPES, onVoxelMode, setVoxelBag, setVoxelMode, voxelBag, voxelMode } from "@/lib/voxel-world";
import { craftVoxelFn } from "@/lib/voxel-world.functions";
import { BlockForge } from "@/components/game/BlockForge";

/** Block mode toggle (F9), block bag counts, crafting (C) and palette ([ and ] cycle). */
export function VoxelHud() {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forge, setForge] = useState(false);
  const bag = voxelBag.items;
  useEffect(() => onVoxelMode(() => force((n) => n + 1)), []);
  const craft = async (out: string) => {
    setBusy(true);
    const r = await craftVoxelFn({ data: { out } }).catch(() => null);
    setBusy(false);
    if (!r) return void toast.error("SIGN IN TO CRAFT");
    setVoxelBag(r.bag);
    if (r.ok) toast.success(`CRAFTED ${out.toUpperCase()}`, { duration: 900 });
    else toast.error(r.error);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "KeyC" && voxelMode.on) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "F9") {
        e.preventDefault();
        setVoxelMode({ on: !voxelMode.on });
        if (!voxelMode.on) return;
        window.dispatchEvent(new CustomEvent("oasis:holster"));
      }
      if (!voxelMode.on) return;
      const i = BLOCKS.findIndex((b) => b.id === voxelMode.block);
      if (e.code === "BracketRight") setVoxelMode({ block: BLOCKS[(i + 1) % BLOCKS.length]!.id });
      if (e.code === "BracketLeft") setVoxelMode({ block: BLOCKS[(i - 1 + BLOCKS.length) % BLOCKS.length]!.id });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div data-no-translate data-embed-pad className="pointer-events-none absolute bottom-[4.6rem] left-1/2 z-[94] flex -translate-x-1/2 flex-col items-center gap-1">
      {voxelMode.on ? (
        <>
          {forge ? <BlockForge onClose={() => setForge(false)} /> : null}
          {open ? (
            <div className="hud-panel pointer-events-auto grid grid-cols-2 gap-1 p-2 font-mono text-[9px]">
              {RECIPES.map((r) => {
                const can = Object.entries(r.cost).every(([k, n]) => (bag?.[k] ?? 0) >= (n ?? 0));
                return (
                  <button key={r.out} type="button" disabled={!can || busy}
                    onPointerDown={(e) => { e.preventDefault(); void craft(r.out); }}
                    className={`border px-1.5 py-0.5 text-left ${can ? "border-bitcoin text-foreground" : "border-border text-muted-foreground"}`}>
                    {r.qty}× {r.out.toUpperCase()} ← {Object.entries(r.cost).map(([k, n]) => `${n} ${k.toUpperCase()}`).join(" + ")}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="hud-panel pointer-events-auto flex gap-[3px] p-[3px]">
            {BLOCKS.map((b) => {
              const n = bag?.[b.id] ?? 0;
              return (
                <button key={b.id} type="button" title={`${b.name} · ${n}`} aria-label={`${b.name} block, ${n} in bag`}
                  onPointerDown={(e) => { e.preventDefault(); setVoxelMode({ block: b.id }); }}
                  className={`relative size-7 border ${voxelMode.block === b.id ? "border-bitcoin ring-1 ring-bitcoin" : "border-border"} ${bag && n === 0 ? "opacity-35" : ""}`}
                  style={{ background: `linear-gradient(${b.top} 0 35%, ${b.side} 35% 100%)` }}>
                  {bag ? <span className="absolute bottom-0 right-0.5 font-mono text-[8px] text-foreground [text-shadow:0_0_2px_hsl(var(--background))]">{n}</span> : null}
                </button>
              );
            })}
            <button type="button" onPointerDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
              className={`border px-1.5 font-mono text-[9px] ${open ? "border-bitcoin text-bitcoin" : "border-border text-signal"}`}>CRAFT · C</button>
            <button type="button" onPointerDown={(e) => { e.preventDefault(); setForge((o) => !o); }}
              className={`border px-1.5 font-mono text-[9px] ${forge ? "border-bitcoin text-bitcoin" : "border-border text-signal"}`}>FORGE</button>
          </div>
          <p className="hud-panel px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
            <span className="text-bitcoin">{BLOCKS.find((b) => b.id === voxelMode.block)?.name} ×{bag?.[voxelMode.block] ?? 0}</span>
            {bag ? " · LEFT CLICK GROUND GATHER / BLOCK PICK UP · RIGHT CLICK PLACE · [ ] SWITCH · F9 EXIT" : " · SIGN IN TO GET A BLOCK BAG"}
          </p>
        </>
      ) : null}
      <button type="button" onPointerDown={(e) => { e.preventDefault(); setVoxelMode({ on: !voxelMode.on }); if (voxelMode.on) window.dispatchEvent(new CustomEvent("oasis:holster")); }}
        className={`hud-panel pointer-events-auto px-2 py-0.5 font-mono text-[9px] ${voxelMode.on ? "text-bitcoin" : "text-signal"}`}>
        ▦ BLOCKS {voxelMode.on ? "ON" : "OFF"} · F9
      </button>
    </div>
  );
}
