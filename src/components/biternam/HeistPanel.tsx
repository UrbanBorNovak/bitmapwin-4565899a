import { useState } from "react";
import { HEIST_STEPS, HEIST_ITEMS, advanceHeist, heldHeistItem, resetHeist, useHeistStage, type HeistRoom } from "@/lib/void-heist";
import { playSfx } from "@/lib/retro-sfx";

/** CH.4 objective card shown in every interior; acts only when this room is the current link. */
export function HeistPanel({ room, ready = true }: { room: HeistRoom; ready?: boolean }) {
  const stage = useHeistStage();
  const [open, setOpen] = useState(true);
  const [line, setLine] = useState<string | null>(null);
  const [boom, setBoom] = useState(false);
  const step = HEIST_STEPS[stage];
  const held = heldHeistItem(stage);
  const here = step?.room === room;

  const act = () => {
    if (!step || !here || !ready) { playSfx("deny"); return; }
    if (advanceHeist(stage)) {
      setLine(step.line);
      if (step.gives === "void") { playSfx("fall"); setBoom(true); setTimeout(() => setBoom(false), 2600); } else playSfx("pickup");
    }
  };

  return (
    <>
      {boom && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center animate-pulse bg-background/70 backdrop-blur-sm">
          <div className="font-mono text-2xl tracking-widest text-primary">◎ THE VOID IS OPEN ◎</div>
        </div>
      )}
      <div className="absolute right-3 top-3 z-30 w-72 max-w-[calc(100vw-1.5rem)] border border-primary/40 bg-card/85 p-3 font-mono text-[11px] backdrop-blur" data-no-translate={false}>
        <button className="flex w-full justify-between text-primary" onClick={() => setOpen((o) => !o)}>
          <span>CH.4 · THE VOID HEIST {stage}/{HEIST_STEPS.length}</span><span>{open ? "−" : "+"}</span>
        </button>
        {open && (
          <div className="mt-2 space-y-2">
            <div className="text-muted-foreground">HOLDING: <span className="text-foreground">{held ? HEIST_ITEMS[held] : "NOTHING"}</span></div>
            {step ? (
              <>
                <div className="text-accent">{here ? "▶ " : "→ "}{step.hint}{!here && ` (${step.room.toUpperCase()})`}</div>
                {here && (
                  <button onClick={act} disabled={!ready} className="w-full border border-primary bg-primary/15 px-2 py-1.5 text-primary hover:bg-primary/30 disabled:opacity-40">
                    {ready ? step.action : "FINISH THIS ROOM'S PUZZLE FIRST"}
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-primary">★ VOID HEIST COMPLETE — the trapdoor stands open.</div>
                <button onClick={() => { resetHeist(); setLine(null); }} className="text-muted-foreground underline">replay chapter</button>
              </div>
            )}
            {line && <div className="border-t border-border pt-2 text-foreground">{line}</div>}
          </div>
        )}
      </div>
    </>
  );
}
