import { useEffect, useMemo, useRef, useState } from "react";
import type { ProvenanceEvent } from "@/lib/passport";

/**
 * "Grapes" view of the World Stream: each BITMAP is a vine node, each real
 * event is a grape hanging off it, and wallets tie bunches together. Events
 * are replayed in the order they happened so the clusters grow like history.
 */
type Node = { id: string; kind: "bitmap" | "event" | "wallet"; x: number; y: number; vx: number; vy: number; r: number; tone: string; label: string; ev?: ProvenanceEvent; born: number };
type Edge = { a: number; b: number; len: number };

function toneFor(e: ProvenanceEvent) {
  const t = e.eventType;
  if (/raid|duel|combat|boss|strike/.test(t)) return "--destructive";
  if (/build|stamp|forge|voxel/.test(t)) return "--accent-foreground";
  if (e.proofLevel === "CHAIN") return "--bitcoin";
  return "--signal";
}

export function StreamConstellation({ events, height = 460 }: { events: ProvenanceEvent[]; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => [...events].sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt)), [events]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState<ProvenanceEvent | null>(null);
  const graph = useRef<{ nodes: Node[]; edges: Edge[]; idx: Map<string, number> }>({ nodes: [], edges: [], idx: new Map() });

  // build full graph once per data set; visibility is driven by `born` vs step
  useEffect(() => {
    const nodes: Node[] = []; const edges: Edge[] = []; const idx = new Map<string, number>();
    const add = (n: Omit<Node, "x" | "y" | "vx" | "vy">) => {
      if (idx.has(n.id)) return idx.get(n.id)!;
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 160;
      nodes.push({ ...n, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0 });
      idx.set(n.id, nodes.length - 1); return nodes.length - 1;
    };
    ordered.forEach((e, i) => {
      const ev = add({ id: "e" + e.id, kind: "event", r: 4, tone: toneFor(e), label: e.title, ev: e, born: i });
      if (e.bitmapHeight != null) {
        const b = add({ id: "b" + e.bitmapHeight, kind: "bitmap", r: 7, tone: "--bitcoin", label: `${e.bitmapHeight}.BITMAP`, born: i });
        edges.push({ a: ev, b, len: 22 });
      }
      if (e.actorWallet) {
        const w = add({ id: "w" + e.actorWallet, kind: "wallet", r: 3, tone: "--muted-foreground", label: e.actorWallet.slice(0, 6) + "…", born: i });
        edges.push({ a: ev, b: w, len: 46 });
      }
    });
    graph.current = { nodes, edges, idx };
    setStep(0); setPlaying(true);
  }, [ordered]);

  // playback
  useEffect(() => {
    if (!playing || !ordered.length) return;
    const t = setInterval(() => setStep((s) => { if (s >= ordered.length) { setPlaying(false); return s; } return s + 1; }), 450);
    return () => clearInterval(t);
  }, [playing, ordered.length]);

  const stepRef = useRef(step); stepRef.current = step;

  // physics + render loop
  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const col = (v: string) => css.getPropertyValue(v).trim() || "currentColor";
    let raf = 0; let t0 = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      const dpr = window.devicePixelRatio || 1; const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      const { nodes, edges } = graph.current; const s = stepRef.current;
      const vis = (n: Node) => n.born < s;
      // forces
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]; if (!vis(a)) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]; if (!vis(b)) continue;
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01;
          if (d2 > 40000) continue;
          const f = 900 / d2; const d = Math.sqrt(d2);
          a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
        a.vx -= a.x * 0.004; a.vy -= a.y * 0.004;
      }
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b]; if (!vis(a) || !vis(b)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - e.len) * 0.04;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      for (const n of nodes) { n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx * dt * 30; n.y += n.vy * dt * 30; }
      // draw
      ctx.setTransform(dpr, 0, 0, dpr, w / 2 * dpr, h / 2 * dpr);
      ctx.clearRect(-w / 2, -h / 2, w, h);
      ctx.lineWidth = 0.8;
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b]; if (!vis(a) || !vis(b)) continue;
        const fresh = Math.max(a.born, b.born) >= s - 2;
        ctx.strokeStyle = col(fresh ? "--signal" : "--border"); ctx.globalAlpha = fresh ? 0.9 : 0.6;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const n of nodes) {
        if (!vis(n)) continue;
        const fresh = n.born >= s - 1; const c = col(n.tone);
        ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = fresh ? 18 : n.kind === "event" ? 6 : 0;
        ctx.beginPath();
        if (n.kind === "bitmap") { ctx.rect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); }
        else ctx.arc(n.x, n.y, n.r * (fresh ? 1.5 : 1), 0, Math.PI * 2);
        ctx.fill(); ctx.shadowBlur = 0;
        if (n.kind === "bitmap") { ctx.fillStyle = col("--muted-foreground"); ctx.font = "9px 'Space Mono', monospace"; ctx.fillText(n.label, n.x + 10, n.y + 3); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function pick(ev: React.MouseEvent) {
    const cv = canvas.current; if (!cv) return;
    const r = cv.getBoundingClientRect(); const x = ev.clientX - r.left - r.width / 2, y = ev.clientY - r.top - r.height / 2;
    let best: Node | null = null, bd = 144;
    for (const n of graph.current.nodes) { if (n.kind !== "event" || n.born >= step) continue; const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } }
    setHover(best?.ev ?? null);
  }

  const cur = ordered[Math.max(0, step - 1)];
  return (
    <div ref={wrap} className="relative border border-border bg-card/30 backdrop-blur">
      <canvas ref={canvas} onMouseMove={pick} className="block w-full" style={{ height }} aria-label="World stream constellation" />
      <div className="pointer-events-none absolute left-3 top-3 font-mono text-[9px] tracking-[0.2em] text-muted-foreground">
        <p className="text-signal">HISTORY SIMULATION · {Math.min(step, ordered.length)}/{ordered.length} EVENTS</p>
        <p className="mt-1"><span className="text-bitcoin">■</span> BITMAP <span className="ml-2 text-bitcoin">●</span> CHAIN <span className="ml-2 text-signal">●</span> WORLD <span className="ml-2 text-destructive">●</span> RAID</p>
      </div>
      {hover && (
        <div className="pointer-events-none absolute right-3 top-3 max-w-[260px] border border-border bg-background/90 p-2 font-mono text-[10px]">
          <p className="text-foreground">{hover.title}</p>
          <p className="mt-1 text-muted-foreground">{hover.summary}</p>
          <p className="mt-1 text-signal">{hover.proofLevel}{hover.bitmapHeight != null ? ` · ${hover.bitmapHeight}.BITMAP` : ""} · {new Date(hover.occurredAt).toLocaleString()}</p>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2 font-mono text-[10px]">
        <button type="button" onClick={() => { if (step >= ordered.length) setStep(0); setPlaying((p) => !p); }} className="btn-term-ghost shrink-0">{playing ? "[ PAUSE ]" : step >= ordered.length ? "[ REPLAY ]" : "[ PLAY ]"}</button>
        <input type="range" min={0} max={ordered.length} value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} className="flex-1 accent-[var(--signal)]" aria-label="Scrub history" />
        <span className="hidden truncate text-muted-foreground sm:block sm:max-w-[40%]">{cur ? `${new Date(cur.occurredAt).toLocaleDateString()} · ${cur.title}` : "—"}</span>
      </div>
    </div>
  );
}
