/** Sealed LEGO-style box for a kit: tear the tape, lift the lid, numbered bags spill out. */
import { useState } from "react";
import { KitThumb } from "@/components/forge/KitThumb";
import { OtherthingsBadge } from "@/components/OtherthingsBadge";
import { blueprintBlocks } from "@/lib/forge-blueprints";
import { kitBags, type Kit } from "@/lib/forge-kits";

export function KitBox({ kit, setNo, onOpened }: { kit: Kit; setNo: number; onOpened: () => void }) {
  const [phase, setPhase] = useState<"sealed" | "tearing" | "open">("sealed");
  const bags = kitBags(kit);
  const pieces = blueprintBlocks(kit).length;
  const open = () => {
    if (phase !== "sealed") return;
    setPhase("tearing");
    window.setTimeout(() => setPhase("open"), 650);
    window.setTimeout(onOpened, 1900);
  };
  return (
    <div className="relative mt-2 select-none" style={{ perspective: "900px" }}>
      <button type="button" onClick={open} aria-label={`Unbox ${kit.name}`}
        className={`kitbox relative block w-full overflow-hidden rounded-md border-2 border-primary bg-card text-left shadow-lg transition-transform duration-700 ${phase === "open" ? "kitbox-open" : ""}`}>
        {/* header strip: collection + set identity */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-primary px-3 py-1.5 font-mono text-[10px] font-bold text-primary-foreground sm:text-xs">
          <span className="tracking-[0.15em]">◈ THE OTHERTHINGS</span>
          <span className="tracking-[0.15em]">SET #{String(setNo).padStart(3, "0")} · {kit.ages}</span>
        </div>
        {/* hero: the completed build, big and centered */}
        <div className="relative bg-background/70 px-2 pt-2">
          <KitThumb bp={kit} className="mx-auto max-h-56 w-full object-contain sm:max-h-64" />
          <span className="absolute bottom-2 right-2 rounded bg-primary px-2 py-1 font-mono text-xs font-bold text-primary-foreground sm:text-sm">{pieces} PCS</span>
          <span className="absolute bottom-2 left-2 rounded bg-background/85 px-2 py-1 font-mono text-[10px] text-accent sm:text-xs">{kit.difficulty} · {bags.length} BAGS</span>
        </div>
        {/* set details */}
        <div className="space-y-1 px-3 py-2.5">
          <div className="font-display text-base font-bold leading-tight text-foreground sm:text-lg">{kit.name}</div>
          <div className="text-xs text-muted-foreground sm:text-sm">{kit.tagline}</div>
          <div className="pt-1"><OtherthingsBadge child="Forge Kit" /></div>
        </div>
        {/* holographic seal tape */}
        <span className={`kitbox-tape absolute left-1/2 top-0 h-full w-6 -translate-x-1/2 border-x border-accent/60 bg-accent/25 ${phase !== "sealed" ? "kitbox-tape-torn" : ""}`} />
        {phase === "sealed" && (
          <span className="absolute inset-x-0 top-1/2 mx-auto w-max -translate-y-1/2 rounded border border-primary bg-background/90 px-4 py-2.5 font-mono text-sm font-bold text-primary animate-pulse">✂ BREAK SEAL &amp; UNBOX</span>
        )}
      </button>
      {phase === "open" && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {bags.map((b, i) => (
            <span key={b.bag} className="kitbag rounded-lg border border-accent/60 bg-accent/10 px-3 py-2 text-center font-mono text-[10px] text-accent" style={{ animationDelay: `${i * 120}ms` }}>
              <b className="block text-base text-foreground">{b.bag}</b>BAG · {b.steps.length} STEP{b.steps.length > 1 ? "S" : ""}
            </span>
          ))}
          <span className="kitbag rounded-lg border border-primary/60 bg-primary/10 px-3 py-2 text-center font-mono text-[10px] text-primary" style={{ animationDelay: `${bags.length * 120}ms` }}>
            <b className="block text-base">▤</b>BOOKLET
          </span>
        </div>
      )}
    </div>
  );
}
