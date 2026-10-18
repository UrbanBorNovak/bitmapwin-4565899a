import { useEffect, useMemo, useRef, useState } from "react";
import type { ProvenanceEvent } from "@/lib/passport";

/**
 * "Grapes" view of the World Stream: each BITMAP is a vine node, each real
 * event is a grape hanging off it, and wallets tie bunches together. Events
 * are replayed in the order they happened so the clusters grow like history.
 */
type Node = { id: string; kind: "bitmap" | "event" | "wallet"; x: number; y: number; vx: number; vy: number; r: number; tone: string; label: string; ev?: ProvenanceEvent; born: number };
type Edge = { a: number; b: number; len: number };
type Cls = "all" | "bitmap" | "chain" | "world" | "raid";
function clsOf(n: Node): Cls {
  if (n.kind === "bitmap") return "bitmap";
  if (n.kind === "wallet") return "all";
  if (n.tone === "--destructive") return "raid";
  return n.ev?.proofLevel === "CHAIN" ? "chain" : "world";
}
const FILTERS: { k: Cls; label: string; cls: string }[] = [
  { k: "all", label: "ALL", cls: "text-foreground" },
  { k: "bitmap", label: "▣ BITMAP", cls: "text-bitcoin" },
  { k: "chain", label: "◆ CHAIN", cls: "text-bitcoin" },
  { k: "world", label: "● WORLD", cls: "text-signal" },
  { k: "raid", label: "⚔ RAID", cls: "text-destructive" },
];

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
    // keep a full replay under ~40s however deep the history is
    const tick = Math.max(40, Math.min(450, 40_000 / ordered.length));
    const t = setInterval(() => setStep((s) => { if (s >= ordered.length) { setPlaying(false); return s; } return s + 1; }), tick);
    return () => clearInterval(t);
  }, [playing, ordered.length]);

  const stepRef = useRef(step); stepRef.current = step;
  const lockRef = useRef<Node | null>(null);
  const [lock, setLock] = useState<Node | null>(null);
  lockRef.current = lock;
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [fps, setFps] = useState(60);
  const [filter, setFilter] = useState<Cls>("all");
  const filterRef = useRef<Cls>("all"); filterRef.current = filter;
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const [az, setAz] = useState({ az: 0, el: 0, quad: "—" });
  const [audioOn, setAudioOn] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const beep = (f1: number, f2: number, ms: number, vol = 0.04) => {
    if (!audioOn) return;
    const ac = audio.current ?? (audio.current = new AudioContext());
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = "triangle"; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + ms / 1000);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
  };
  // soft tick as each event materialises (throttled for big replays)
  const lastTick = useRef(0);
  useEffect(() => {
    if (!playing || step === 0) return;
    const now = performance.now(); if (now - lastTick.current < 120) return; lastTick.current = now;
    beep(220, 180, 30, 0.02);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // density histogram for the oscilloscope (64 bins across the timeline)
  const density = useMemo(() => {
    const bins = new Array(64).fill(0); if (!ordered.length) return bins;
    const t0 = +new Date(ordered[0]!.occurredAt), t1 = +new Date(ordered[ordered.length - 1]!.occurredAt) || t0 + 1;
    for (const e of ordered) bins[Math.min(63, Math.floor(((+new Date(e.occurredAt) - t0) / Math.max(1, t1 - t0)) * 64))]++;
    const m = Math.max(1, ...bins); return bins.map((b) => b / m);
  }, [ordered]);
  const densityRef = useRef(density); densityRef.current = density;
  const lenRef = useRef(ordered.length); lenRef.current = ordered.length;

  // physics + render loop
  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const col = (v: string) => css.getPropertyValue(v).trim() || "currentColor";
    let raf = 0; let t0 = performance.now(); let frames = 0; let fpsT = t0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      const dpr = window.devicePixelRatio || 1; const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      const { nodes, edges } = graph.current; const s = stepRef.current;
      const vis = (n: Node) => n.born < s;
      // forces
      // settled nodes (born >40 steps ago) only feel forces from fresh ones
      const settled = (n: Node) => n.born < s - 40;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!; if (!vis(a)) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!; if (!vis(b) || (settled(a) && settled(b))) continue;
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01;
          if (d2 > 40000) continue;
          const f = 900 / d2; const d = Math.sqrt(d2);
          a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
        a.vx -= a.x * 0.004; a.vy -= a.y * 0.004;
      }
      for (const e of edges) {
        const a = nodes[e.a]!, b = nodes[e.b]!; if (!vis(a) || !vis(b)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - e.len) * 0.04;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      for (const n of nodes) { n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx * dt * 30; n.y += n.vy * dt * 30; }
      // draw
      ctx.setTransform(dpr, 0, 0, dpr, w / 2 * dpr, h / 2 * dpr);
      ctx.clearRect(-w / 2, -h / 2, w, h);
      const sig = col("--signal"), btc = col("--bitcoin"), mut = col("--muted-foreground");
      const T = now / 1000; const sweep = (T * 0.9) % (Math.PI * 2);
      frames++; if (now - fpsT > 1000) { setFps(frames); frames = 0; fpsT = now; }
      // crosshair grid
      ctx.globalAlpha = 0.18; ctx.strokeStyle = sig; ctx.lineWidth = 0.6;
      for (let gx = -Math.floor(w / 2 / 40) * 40; gx < w / 2; gx += 40) for (let gy = -Math.floor(h / 2 / 40) * 40; gy < h / 2; gy += 40) {
        ctx.beginPath(); ctx.moveTo(gx - 2, gy); ctx.lineTo(gx + 2, gy); ctx.moveTo(gx, gy - 2); ctx.lineTo(gx, gy + 2); ctx.stroke();
      }
      // range rings + ticks
      const R = Math.min(w, h) / 2 - 16;
      ctx.font = "8px 'Space Mono', monospace"; ctx.fillStyle = sig;
      [0.25, 0.5, 0.75, 1].forEach((k, i) => {
        ctx.globalAlpha = i === 3 ? 0.45 : 0.22; ctx.setLineDash(i % 2 ? [3, 5] : []);
        ctx.beginPath(); ctx.arc(0, 0, R * k, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.fillText(`R-${250 * 2 ** i}`, R * k * 0.707 + 3, -R * k * 0.707);
      });
      ctx.setLineDash([]);
      for (let d = 0; d < 360; d += 5) {
        const a = (d * Math.PI) / 180, l = d % 90 === 0 ? 10 : d % 30 === 0 ? 6 : 3;
        ctx.globalAlpha = d % 90 === 0 ? 0.8 : 0.35;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a) * (R - l), Math.sin(a) * (R - l)); ctx.stroke();
        if (d % 90 === 0) ctx.fillText(String((d + 90) % 360).padStart(3, "0") + "°", Math.cos(a) * (R - 26) - 9, Math.sin(a) * (R - 26) + 3);
      }
      // rotating dashed compass dial
      ctx.save(); ctx.rotate(-T * 0.15); ctx.globalAlpha = 0.3; ctx.setLineDash([2, 10]);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.88, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
      // sweep beam
      const g = ctx.createConicGradient ? ctx.createConicGradient(sweep - 0.6, 0, 0) : null;
      if (g) { g.addColorStop(0, "transparent"); g.addColorStop(0.095, sig); g.addColorStop(0.0955, "transparent"); g.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.16; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 0.7; ctx.strokeStyle = sig; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sweep) * R, Math.sin(sweep) * R); ctx.stroke();
      const lit = (n: Node) => { let da = sweep - Math.atan2(n.y, n.x); da = ((da % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return da < 0.5 ? 1 - da / 0.5 : 0; };
      ctx.lineWidth = 0.8;
      const fk = filterRef.current;
      const on = (n: Node) => (fk === "all" || clsOf(n) === fk || (n.kind === "wallet" && false) ? 1 : 0.1);
      for (const e of edges) {
        const a = nodes[e.a]!, b = nodes[e.b]!; if (!vis(a) || !vis(b)) continue;
        const fresh = Math.max(a.born, b.born) >= s - 2; const m = Math.max(on(a), on(b));
        ctx.strokeStyle = col(fresh ? "--signal" : "--border"); ctx.globalAlpha = (fresh ? 0.9 : 0.6) * m;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const p = (T * (fresh ? 0.9 : 0.35) + ((e.a * 7 + e.b * 13) % 100) / 100) % 1;
        ctx.globalAlpha = (fresh ? 1 : 0.55) * m; ctx.fillStyle = fresh ? sig : btc; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, fresh ? 1.8 : 1.1, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      for (const n of nodes) {
        if (!vis(n)) continue;
        const fresh = n.born >= s - 1; const c = col(n.tone); const m = on(n);
        ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.shadowColor = c; const L = lit(n); ctx.shadowBlur = m < 1 ? 0 : fresh ? 18 : (n.kind === "event" ? 6 : 0) + L * 22; ctx.globalAlpha = (0.75 + L * 0.25) * m;
        ctx.beginPath();
        if (n.kind === "bitmap") {
          ctx.rect(n.x - n.r * 0.55, n.y - n.r * 0.55, n.r * 1.1, n.r * 1.1);
          ctx.save(); ctx.strokeStyle = c; ctx.globalAlpha = 0.8 * m; const q = n.r + 3, k = 3; ctx.beginPath();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { ctx.moveTo(n.x + sx * q, n.y + sy * (q - k)); ctx.lineTo(n.x + sx * q, n.y + sy * q); ctx.lineTo(n.x + sx * (q - k), n.y + sy * q); }
          ctx.stroke(); ctx.restore();
        } else if (n.ev?.proofLevel === "CHAIN") { ctx.moveTo(n.x, n.y - n.r * 1.3); ctx.lineTo(n.x + n.r * 1.3, n.y); ctx.lineTo(n.x, n.y + n.r * 1.3); ctx.lineTo(n.x - n.r * 1.3, n.y); ctx.closePath(); }
        else ctx.arc(n.x, n.y, n.r * (fresh ? 1.5 : 1), 0, Math.PI * 2);
        ctx.fill(); ctx.shadowBlur = 0;
        if (n.kind === "bitmap" && m === 1) { ctx.fillStyle = col("--muted-foreground"); ctx.font = "9px 'Space Mono', monospace"; ctx.fillText(n.label, n.x + 12, n.y + 3); }
      }
      // quadrant labels
      ctx.globalAlpha = 0.35; ctx.fillStyle = sig; ctx.font = "8px 'Space Mono', monospace";
      ctx.fillText("QUAD I", w / 2 - 60, -h / 2 + 64); ctx.fillText("QUAD II", -w / 2 + 12, -h / 2 + 64);
      ctx.fillText("QUAD III", -w / 2 + 12, h / 2 - 66); ctx.fillText("QUAD IV", w / 2 - 60, h / 2 - 66);
      // cursor crosshair with azimuth ring
      const cu = cursor.current;
      if (cu) {
        ctx.strokeStyle = sig; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.35; ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(-w / 2, cu.y); ctx.lineTo(w / 2, cu.y); ctx.moveTo(cu.x, -h / 2); ctx.lineTo(cu.x, h / 2); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(cu.x, cu.y, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cu.x, cu.y); ctx.globalAlpha = 0.25; ctx.stroke();
        const azd = ((Math.atan2(cu.y, cu.x) * 180) / Math.PI + 90 + 360) % 360;
        ctx.globalAlpha = 0.9; ctx.fillStyle = sig; ctx.fillText(`AZ ${azd.toFixed(1)}° · R ${Math.hypot(cu.x, cu.y).toFixed(0)}`, cu.x + 18, cu.y - 10);
      }
      // CRT phosphor scanline
      const sy = ((T * 60) % (h + 40)) - h / 2 - 20;
      const sg = ctx.createLinearGradient(0, sy - 20, 0, sy + 2); sg.addColorStop(0, "transparent"); sg.addColorStop(1, sig);
      ctx.globalAlpha = 0.07; ctx.fillStyle = sg; ctx.fillRect(-w / 2, sy - 20, w, 22);
      // event-density oscilloscope along the bottom deck
      const dens = densityRef.current, oy = h / 2 - 24, ow = Math.min(360, w * 0.45), ox = -ow / 2;
      const prog = lenRef.current ? s / lenRef.current : 0;
      ctx.globalAlpha = 0.25; ctx.strokeStyle = sig; ctx.strokeRect(ox - 4, oy - 22, ow + 8, 30);
      ctx.beginPath(); ctx.moveTo(ox, oy - 7); ctx.lineTo(ox + ow, oy - 7); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.shadowColor = sig; ctx.shadowBlur = 6;
      for (const pass of [0, 1]) {
        ctx.globalAlpha = pass ? 0.95 : 0.3; ctx.beginPath();
        const lim = pass ? Math.floor(prog * 64) : 64;
        for (let i = 0; i < lim; i++) {
          const x = ox + (i / 63) * ow, jit = Math.sin(T * 9 + i * 1.7) * 1.2 * (pass ? 1 : 0.3);
          const y = oy - 7 - dens[i]! * 13 * (i % 2 ? 1 : -0.6) + jit;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0; ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.6; ctx.fillStyle = sig; ctx.fillText("EVT.DENSITY // OSC", ox - 2, oy - 26);
      ctx.globalAlpha = 1;
      // target lock reticle + leader line to the HUD card (top-right)
      const lk = lockRef.current;
      if (lk && vis(lk)) {
        ctx.strokeStyle = sig; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.save(); ctx.translate(lk.x, lk.y); ctx.rotate((i % 2 ? -1 : 1) * T * (1 + i * 0.6)); ctx.globalAlpha = 0.9 - i * 0.25;
          ctx.setLineDash(i === 1 ? [4, 4] : []); const rr = 10 + i * 6;
          for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(0, 0, rr, q * Math.PI / 2 + 0.2, q * Math.PI / 2 + 1.2); ctx.stroke(); }
          ctx.restore();
        }
        ctx.setLineDash([]);
        const tx = w / 2 - 280, ty = -h / 2 + 40, mx = tx - Math.abs(ty - lk.y) * 0.5;
        ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(lk.x, lk.y); ctx.lineTo(Math.max(lk.x, Math.min(mx, tx)), ty); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = sig; ctx.fillRect(tx - 2, ty - 2, 4, 4);
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
    if ((best?.ev ?? null) !== hover && best) beep(900, 1300, 25, 0.015);
    setHover(best?.ev ?? null);
    cursor.current = { x, y };
    const azd = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
    setAz({ az: azd, el: (-y / (r.height / 2)) * 45, quad: x >= 0 ? (y < 0 ? "I" : "IV") : (y < 0 ? "II" : "III") });
    setTilt({ x: (ev.clientY - r.top) / r.height - 0.5, y: (ev.clientX - r.left) / r.width - 0.5 });
    return best;
  }
  function lockOn(ev: React.MouseEvent) {
    const n = pick(ev); const next = n && n !== lock ? n : null;
    if (next) beep(1200, 1800, 70, 0.05); else if (lock) beep(600, 300, 60, 0.03);
    setLock(next);
  }

  const cur = ordered[Math.max(0, step - 1)];
  const card = lock?.ev ?? hover;
  const hash = (id: string) => { let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(16).padStart(8, "0"); };
  const pct = ordered.length ? (Math.min(step, ordered.length) / ordered.length) * 100 : 0;
  return (
    <div ref={wrap} className="relative overflow-hidden border border-signal/30 bg-card/30 backdrop-blur" style={{ perspective: 1100 }}>
      {(["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "left-0 bottom-0 border-l border-b", "right-0 bottom-0 border-r border-b"]).map((c) => (
        <span key={c} className={`pointer-events-none absolute z-10 h-4 w-4 border-signal ${c}`} />
      ))}
      <canvas ref={canvas} onMouseMove={pick} onClick={lockOn} onMouseLeave={() => { setTilt({ x: 0, y: 0 }); cursor.current = null; }}
        className="block w-full cursor-crosshair transition-transform duration-300 ease-out" aria-label="World stream constellation"
        style={{ height, transform: `rotateX(${(-tilt.x * 7).toFixed(2)}deg) rotateY(${(tilt.y * 9).toFixed(2)}deg)` }} />
      <div className="pointer-events-none absolute left-3 top-3 font-mono text-[9px] tracking-[0.2em] text-muted-foreground">
        <p className="text-signal">S.A.T.O.S.H.I. // TACTICAL PROVENANCE SYSTEM</p>
        <p className="text-[7px] text-signal/50">SPATIAL AUTONOMOUS TACTICAL ORDINAL SETTLEMENT &amp; HISTORY INTERFACE</p>
        <p className="mt-1">HISTORY SIM · {Math.min(step, ordered.length)}/{ordered.length} EVENTS · {fps} FPS · <span className={playing ? "text-signal" : "text-bitcoin"}>{playing ? "SYNCHRONIZING" : "STANDBY"}</span></p>
        <p className="mt-1">AZ {az.az.toFixed(1)}° · EL {az.el >= 0 ? "+" : ""}{az.el.toFixed(1)}° · QUAD {az.quad}</p>
        <div className="pointer-events-auto mt-2 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f.k} type="button" onClick={() => { setFilter(f.k); beep(700, 1000, 35, 0.03); }}
              className={`border px-1.5 py-0.5 text-[8px] tracking-[0.15em] transition-colors ${filter === f.k ? "border-signal bg-signal/15 " + f.cls : "border-border bg-background/60 text-muted-foreground hover:border-signal/60"}`}>
              [ {f.label} ]
            </button>
          ))}
          <button type="button" onClick={() => { const n = !audioOn; setAudioOn(n); if (n) { audio.current ??= new AudioContext(); void audio.current.resume(); } }}
            className={`border px-1.5 py-0.5 text-[8px] tracking-[0.15em] ${audioOn ? "border-bitcoin text-bitcoin" : "border-border bg-background/60 text-muted-foreground"}`}>
            [ AUDIO: {audioOn ? "ON" : "MUTED"} ]
          </button>
        </div>
      </div>
      <p className="pointer-events-none absolute bottom-14 left-3 font-mono text-[8px] tracking-[0.2em] text-signal/60">SYS: ONLINE · VEC.SYNC · CLICK NODE TO LOCK</p>
      {card && (
        <div className="pointer-events-none absolute right-3 top-8 w-[268px] border border-signal/50 bg-background/85 p-2 font-mono text-[10px] shadow-[0_0_24px_-6px_var(--signal)]">
          <p className="mb-1 text-[8px] tracking-[0.25em] text-signal">{lock ? "◉ TARGET LOCKED" : "○ SCANNING"}</p>
          <p className="text-foreground">{card.title}</p>
          <p className="mt-1 line-clamp-3 text-muted-foreground">{card.summary}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-2 border-t border-border pt-1 text-[9px] text-muted-foreground">
            <span>PROOF</span><span className={card.proofLevel === "CHAIN" ? "text-bitcoin" : "text-signal"}>{card.proofLevel}</span>
            {card.bitmapHeight != null && (<><span>TERRITORY</span><span className="text-bitcoin">{card.bitmapHeight}.BITMAP</span></>)}
            <span>CLASS</span><span className="text-foreground">{card.eventType.toUpperCase()}</span>
            <span>EVENT_HASH</span><span className="text-signal">0x{hash(card.id)}</span>
            <span>T</span><span className="text-foreground">{new Date(card.occurredAt).toLocaleString()}</span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-signal/30 px-3 py-2 font-mono text-[10px]">
        <button type="button" onClick={() => { if (step >= ordered.length) setStep(0); setPlaying((p) => !p); }} className="btn-term-ghost shrink-0">{playing ? "[ PAUSE ]" : step >= ordered.length ? "[ REPLAY ]" : "[ PLAY ]"}</button>
        <div className="relative h-5 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,var(--signal)_0_1px,transparent_1px_10px)] opacity-40" />
          <div className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-signal shadow-[0_0_10px_var(--signal)]" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 h-3 w-1 -translate-y-1/2 bg-signal shadow-[0_0_10px_var(--signal)]" style={{ left: `calc(${pct}% - 2px)` }} />
          <input type="range" min={0} max={ordered.length} value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} className="absolute inset-0 w-full cursor-pointer opacity-0" aria-label="Scrub history" />
        </div>
        <span className="hidden truncate text-muted-foreground sm:block sm:max-w-[40%]">{cur ? `${new Date(cur.occurredAt).toLocaleDateString()} · ${cur.title}` : "—"}</span>
      </div>
    </div>
  );
}
