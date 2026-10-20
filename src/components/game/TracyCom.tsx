import { useCallback, useEffect, useRef, useState } from "react";
import { advance, nodeById, typedLength, type TracyMood, type TracyScript } from "@/lib/tracy-com";

/** Tiny synth chirp — no audio files. */
function useBleep() {
  const ctx = useRef<AudioContext | null>(null);
  return useCallback((freq: number, dur = 0.03, vol = 0.03) => {
    try {
      ctx.current ??= new AudioContext();
      const a = ctx.current;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur);
    } catch {
      /* audio blocked — silent is fine */
    }
  }, []);
}

/** Dithered pixel face drawn as SVG rects; mouth/eyes follow speech + mood. */
function Portrait({ mood, talking, blink }: { mood: TracyMood; talking: boolean; blink: boolean }) {
  const px = (x: number, y: number, w = 1, h = 1, o = 1) => <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} opacity={o} />;
  const mouthOpen = talking;
  return (
    <svg viewBox="0 0 16 16" className="h-full w-full fill-current" shapeRendering="crispEdges" aria-hidden>
      {/* hair */}
      {px(4, 2, 8, 2)}
      {px(3, 3, 1, 6)}
      {px(12, 3, 1, 6)}
      {/* face */}
      {px(4, 4, 8, 7, 0.35)}
      {/* eyes */}
      {blink ? [px(5, 7, 2, 1), px(9, 7, 2, 1)] : [px(5, 6, 2, 2), px(9, 6, 2, 2)]}
      {mood === "smug" && px(9, 5, 2, 1)}
      {mood === "alarm" && [px(5, 5, 2, 1), px(9, 5, 2, 1)]}
      {/* mouth */}
      {mouthOpen ? px(6, 9, 4, 2) : px(mood === "smug" ? 7 : 6, 9, mood === "smug" ? 3 : 4, 1)}
      {/* headset mic */}
      {px(12, 8, 1, 3)}
      {px(10, 11, 2, 1)}
      {/* shoulders */}
      {px(3, 12, 10, 4, 0.6)}
    </svg>
  );
}

export function TracyCom({ script, onEnd, className = "" }: { script: TracyScript; onEnd?: () => void; className?: string }) {
  const [nodeId, setNodeId] = useState<string | null>(script.start);
  const [started, setStarted] = useState(() => performance.now());
  const [now, setNow] = useState(() => performance.now());
  const [blink, setBlink] = useState(false);
  const bleep = useBleep();
  const node = nodeById(script, nodeId);
  const shown = node ? typedLength(node.text, now - started) : 0;
  const done = !!node && shown >= node.text.length;
  const lastShown = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const b = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 140); }, 3200);
    return () => { cancelAnimationFrame(raf); clearInterval(b); };
  }, []);

  useEffect(() => {
    if (shown > lastShown.current && shown % 3 === 0 && node?.text[shown - 1]?.trim()) {
      bleep(node.mood === "glitch" ? 180 + Math.random() * 600 : 520 + (shown % 5) * 40);
    }
    lastShown.current = shown;
  }, [shown, node, bleep]);

  const goTo = useCallback((next: ReturnType<typeof advance>) => {
    if (!next) { setNodeId(null); onEnd?.(); return; }
    lastShown.current = 0;
    setNodeId(next.id);
    setStarted(performance.now());
  }, [onEnd]);

  const step = useCallback((choice?: number) => {
    if (!node) return;
    if (!done) { setStarted(-1e9); return; } // skip typing
    if (node.choices?.length && choice === undefined) return;
    bleep(880, 0.05);
    goTo(advance(script, node, choice));
  }, [node, done, script, goTo, bleep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!node) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); step(); }
      const n = Number(e.key);
      if (done && node.choices && n >= 1 && n <= node.choices.length) step(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, done, step]);

  if (!node) return null;
  const glitch = node.mood === "glitch";

  return (
    <div className={`tracy-com pointer-events-auto w-[min(420px,92vw)] select-none rounded-[18px] border border-border-strong bg-background/80 p-2 font-mono text-signal shadow-2xl backdrop-blur ${className}`} role="dialog" aria-label={`${node.speaker} transmission`}>
      <div className="flex items-center justify-between px-2 pb-1 text-[10px] tracking-widest text-muted-foreground">
        <span><span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />WRIST-COM · LIVE</span>
        <span>{script.title}</span>
      </div>
      <div className={`tracy-crt relative overflow-hidden rounded-[14px] border border-signal/30 bg-muted p-3 ${glitch ? "tracy-glitch" : ""}`} onClick={() => step()}>
        <div className="flex gap-3">
          <div className="h-20 w-20 shrink-0 rounded-md border border-signal/40 bg-background/60 p-1">
            <Portrait mood={node.mood ?? "idle"} talking={!done && Math.floor(now / 110) % 2 === 0} blink={blink} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] tracking-widest text-primary">{node.speaker}</div>
            <p className="mt-1 min-h-[4.5rem] text-[13px] leading-snug">
              {node.text.slice(0, shown)}
              <span className={done ? "animate-pulse" : ""}>▌</span>
            </p>
          </div>
        </div>
        {done && node.choices?.length ? (
          <div className="mt-2 space-y-1">
            {node.choices.map((c, i) => (
              <button key={c.label} type="button" onClick={(e) => { e.stopPropagation(); step(i); }} className="block w-full rounded border border-signal/30 px-2 py-1 text-left text-[12px] hover:bg-signal hover:text-signal-foreground">
                [{i + 1}] {c.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-right text-[10px] text-muted-foreground">{done ? "SPACE / CLICK ▸" : "SPACE TO SKIP"}</div>
        )}
      </div>
      <div className="flex justify-between px-2 pt-1 text-[10px] text-muted-foreground">
        <span>SIGNAL {glitch ? "41.7" : "98.4"}%</span>
        <span>L1 LINK OK</span>
      </div>
    </div>
  );
}
