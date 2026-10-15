/** Sealed LEGO-style box for a kit: tear the tape, lift the lid, numbered bags spill out. */
import { useState } from "react";
import { KitThumb } from "@/components/forge/KitThumb";
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
        <div className="flex items-center justify-between bg-primary px-2 py-1 font-mono text-[10px] font-bold text-primary-foreground">
          <span>BITMAP FORGE · SET #{String(setNo).padStart(3, "0")}</span><span>{kit.ages}</span>
        </div>
        <div className="relative bg-background/70">
          <KitThumb bp={kit} />
          <span className="absolute bottom-1 right-1 rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">{pieces} PCS</span>
          <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 py-0.5 font-mono text-[9px] text-accent">{kit.difficulty} · {bags.length} BAGS</span>
        </div>
        <div className="px-2 py-1.5">
          <div className="font-display text-sm font-bold text-foreground">{kit.name}</div>
          <div className="text-[10px] text-muted-foreground">{kit.tagline}</div>
        </div>
        {/* holographic seal tape */}
        <span className={`kitbox-tape absolute left-1/2 top-0 h-full w-6 -translate-x-1/2 border-x border-accent/60 bg-accent/25 ${phase !== "sealed" ? "kitbox-tape-torn" : ""}`} />
        {phase === "sealed" && (
          <span className="absolute inset-x-0 top-1/2 mx-auto w-max -translate-y-1/2 rounded border border-primary bg-background/90 px-3 py-2 font-mono text-xs font-bold text-primary animate-pulse">✂ BREAK SEAL &amp; UNBOX</span>
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
