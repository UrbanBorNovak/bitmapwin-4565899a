/** CRT overlay puzzles for the Mempool Arcade: Fee Sorter and Hash Match. */
import { useState } from "react";
import { FEE_ROUND, feeOrderCorrect, HASH_TARGET, toyHash } from "@/lib/arcade-verbs";
import { playSfx } from "@/lib/retro-sfx";

const bin = (n: number, w: number) => n.toString(2).padStart(w, "0");

function Crt({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-3">
      <div className="w-full max-w-md rounded-[1.5rem] border-4 border-border bg-card p-4 font-mono shadow-[0_0_40px_hsl(var(--signal)/0.25)]">
        <div className="rounded-xl border border-signal/40 bg-background p-4" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 2px, hsl(var(--signal) / 0.06) 2px 3px)" }}>
          <div className="mb-3 flex items-center justify-between text-[12px] tracking-[0.3em] text-signal">
            <span>{title}</span>
            <button onClick={onClose} className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-signal">[ X ]</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function FeeSorter({ onWin, onClose }: { onWin: () => void; onClose: () => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [msg, setMsg] = useState("Pick transactions from HIGHEST fee rate to lowest.");
  const pick = (f: number) => {
    const next = [...picked, f];
    const want = [...FEE_ROUND].sort((a, b) => b - a);
    if (want[next.length - 1] !== f) { playSfx("deny"); setPicked([]); setMsg("ORPHANED! Wrong order. The miners laugh. Try again."); return; }
    playSfx("hover"); setPicked(next);
    if (feeOrderCorrect(next)) { playSfx("pickup"); setMsg("BLOCK PACKED! HIGH SCORE."); setTimeout(onWin, 900); }
  };
  return (
    <Crt title="FEE SORTER" onClose={onClose}>
      <div className="mb-3 text-[13px] text-foreground">{msg}</div>
      <div className="grid grid-cols-5 gap-2">
        {FEE_ROUND.map((f) => {
          const at = picked.indexOf(f);
          return (
            <button key={f} disabled={at >= 0} onClick={() => pick(f)}
              className={`rounded border px-1 py-3 text-[12px] ${at >= 0 ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:border-signal"}`}>
              TX<br />{f}<br /><span className="text-[10px] text-muted-foreground">sat/vB</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">BLOCK: {picked.join(" › ") || "empty"}</div>
    </Crt>
  );
}

export function HashMatch({ onWin, onClose }: { onWin: () => void; onClose: () => void }) {
  const [bits, setBits] = useState(0);
  const [won, setWon] = useState(false);
  const h = toyHash(bits);
  const flip = (i: number) => {
    if (won) return;
    const nb = bits ^ (1 << (7 - i)); setBits(nb); playSfx("hover");
    if (toyHash(nb) === HASH_TARGET) { setWon(true); playSfx("pickup"); setTimeout(onWin, 900); }
  };
  return (
    <Crt title="HASH MATCH" onClose={onClose}>
      <div className="mb-3 text-[13px] text-foreground">Flip the input bits until your hash matches the target.</div>
      <div className="mb-3 grid grid-cols-8 gap-1">
        {Array.from({ length: 8 }, (_, i) => {
          const on = (bits >> (7 - i)) & 1;
          return <button key={i} onClick={() => flip(i)} className={`rounded border py-3 text-[14px] ${on ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:border-signal"}`}>{on}</button>;
        })}
      </div>
      <div className="flex justify-between text-[13px]">
        <span className="text-muted-foreground">TARGET <span className="text-signal">{bin(HASH_TARGET, 4)}</span></span>
        <span className="text-muted-foreground">YOUR HASH <span className={h === HASH_TARGET ? "text-primary" : "text-foreground"}>{bin(h, 4)}</span></span>
      </div>
      {won ? <div className="mt-3 text-center text-[13px] text-primary">MATCH! HIGH SCORE.</div> : null}
    </Crt>
  );
}
