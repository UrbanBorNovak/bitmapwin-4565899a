import { useEffect, useState } from "react";
import { BLOCKS, onVoxelMode, setVoxelMode, voxelMode } from "@/lib/voxel-world";

/** Block mode toggle (F9) and block palette ([ and ] cycle). */
export function VoxelHud() {
  const [, force] = useState(0);
  useEffect(() => onVoxelMode(() => force((n) => n + 1)), []);
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
          <div className="hud-panel pointer-events-auto flex gap-[3px] p-[3px]">
            {BLOCKS.map((b) => (
              <button key={b.id} type="button" title={b.name} aria-label={`${b.name} block`}
                onPointerDown={(e) => { e.preventDefault(); setVoxelMode({ block: b.id }); }}
                className={`relative size-7 border ${voxelMode.block === b.id ? "border-bitcoin ring-1 ring-bitcoin" : "border-border"}`}
                style={{ background: `linear-gradient(${b.top} 0 35%, ${b.side} 35% 100%)` }} />
            ))}
          </div>
          <p className="hud-panel px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
            <span className="text-bitcoin">{BLOCKS.find((b) => b.id === voxelMode.block)?.name}</span> · LEFT CLICK BREAK · RIGHT CLICK PLACE · [ ] SWITCH · F9 EXIT
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
