/** Sealed LEGO-style box for a kit: tear the tape, lift the lid, numbered bags spill out. Flip for the back of the box. */
import { useState } from "react";
import { KitThumb } from "@/components/forge/KitThumb";
import { OtherthingsBadge } from "@/components/OtherthingsBadge";
import { blueprintBlocks } from "@/lib/forge-blueprints";
import { BEHAVIOR_CARDS, kitBags, type Kit } from "@/lib/forge-kits";

const cardInfo = (id: string) => BEHAVIOR_CARDS.find((c) => c.id === id);

export function KitBox({ kit, setNo, onOpened }: { kit: Kit; setNo: number; onOpened: () => void }) {
  const [phase, setPhase] = useState<"sealed" | "tearing" | "open">("sealed");
  const [side, setSide] = useState<"front" | "back">("front");
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
      <div
        className={`kitbox relative block w-full overflow-hidden rounded-md border-2 border-primary bg-card text-left shadow-lg transition-transform duration-700 ${phase === "open" ? "kitbox-open" : ""}`}
        role="button" tabIndex={0} aria-label={`Unbox ${kit.name}`}
        onClick={() => (side === "front" ? open() : setSide("front"))}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); side === "front" ? open() : setSide("front"); } }}
      >
        {/* header strip: collection + set identity */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-primary px-3 py-1.5 font-mono text-[10px] font-bold text-primary-foreground sm:text-xs">
          <span className="tracking-[0.15em]">◈ THE OTHERTHINGS</span>
          <span className="tracking-[0.15em]">SET #{String(setNo).padStart(3, "0")} · {kit.ages}</span>
        </div>

        {side === "front" ? (
          <>
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
              <div className="flex items-center justify-between pt-1">
                <OtherthingsBadge child="Forge Kit" />
                {phase === "sealed" && (
                  <span
                    role="button" tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setSide("back"); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSide("back"); } }}
                    className="rounded border border-accent/60 bg-accent/10 px-2 py-1 font-mono text-[10px] font-bold text-accent hover:bg-accent/20"
                  >⟲ BACK OF BOX</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3 bg-background/70 px-3 py-3">
            {/* moving parts close-ups */}
            <div>
              <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Moving parts</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {kit.behaviors.map((b) => {
                  const info = cardInfo(b.card);
                  const sub = { ...kit, steps: kit.steps.filter((_, i) => b.steps.includes(i)) };
                  return (
                    <div key={b.card} className="overflow-hidden rounded-md border border-border bg-card">
                      <KitThumb bp={sub} className="max-h-28 w-full object-contain" />
                      <div className="px-2 py-1.5">
                        <div className="font-mono text-[10px] font-bold text-primary">{info?.name ?? b.card}</div>
                        <div className="text-[10px] leading-snug text-muted-foreground">{info?.blurb}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* instruction booklet preview */}
            <div>
              <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Instruction booklet · {kit.steps.length} steps</div>
              <div className="grid grid-cols-3 gap-2">
                {kit.steps.slice(0, 3).map((s, i) => (
                  <div key={s.title} className="overflow-hidden rounded-md border border-border bg-card">
                    <KitThumb bp={kit} upTo={i + 1} className="max-h-20 w-full object-contain" />
                    <div className="px-1.5 py-1 font-mono text-[9px] leading-tight text-muted-foreground">
                      <b className="text-foreground">{i + 1}.</b> {s.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <OtherthingsBadge child="Forge Kit" />
              <span className="font-mono text-[10px] text-muted-foreground">tap to flip back ⟲</span>
            </div>
          </div>
        )}

        {/* holographic seal tape */}
        {side === "front" && (
          <span className={`kitbox-tape absolute left-1/2 top-0 h-full w-6 -translate-x-1/2 border-x border-accent/60 bg-accent/25 ${phase !== "sealed" ? "kitbox-tape-torn" : ""}`} />
        )}
        {side === "front" && phase === "sealed" && (
          <span className="absolute inset-x-0 top-1/2 mx-auto w-max -translate-y-1/2 rounded border border-primary bg-background/90 px-4 py-2.5 font-mono text-sm font-bold text-primary animate-pulse">✂ BREAK SEAL &amp; UNBOX</span>
        )}
      </div>
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
