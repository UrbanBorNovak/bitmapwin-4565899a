import { useEffect, useRef } from "react";

export type HuntTarget = { id: string; label: string; price: number; hot?: boolean };

/** Procedural cyber-spider that patrols real listings: walks to each node, scans it, pounces on matches. Visual only. */
export function SpiderHunter({ targets, running }: { targets: HuntTarget[]; running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useRef({ targets, running });
  data.current = { targets, running };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const tok = (n: string, f: string) => {
      const v = css.getPropertyValue(n).trim();
      return v ? (v.startsWith("#") || v.includes("(") ? v : `hsl(${v})`) : f;
    };
    const ORANGE = tok("--bitcoin", "#f7931a");
    const CYAN = tok("--signal", "#3ee6ff");
    const LINE = tok("--border", "#1f2a35");
    const TEXT = tok("--muted-foreground", "#7d8b99");

    let W = 0, H = 0;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const body = { x: 80, y: 80, a: 0 };
    let targetIdx = 0, scan = 0, pounce = 0;
    // 8 legs: each has a planted foot that steps when too far from its rest spot
    const legs = Array.from({ length: 8 }, (_, i) => {
      const side = i < 4 ? -1 : 1;
      const k = i % 4;
      return { side, ang: (-0.9 + k * 0.6) , fx: 80, fy: 80, sx: 80, sy: 80, t: 1, group: (k + (side > 0 ? 1 : 0)) % 2 };
    });
    let raf = 0, last = performance.now(), time = 0;

    const nodes = () => {
      const t = data.current.targets.slice(0, 12);
      const cols = Math.max(1, Math.ceil(Math.sqrt(t.length * (W / Math.max(H, 1)))));
      const rows = Math.max(1, Math.ceil(t.length / cols));
      return t.map((x, i) => ({
        ...x,
        x: ((i % cols) + 0.5) * (W / cols),
        y: (Math.floor(i / cols) + 0.5) * (H / rows) + 6,
      }));
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; time += dt;
      const ns = nodes();
      const live = data.current.running;
      ctx.clearRect(0, 0, W, H);

      // grid
      ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // web threads between nodes
      ctx.strokeStyle = CYAN; ctx.globalAlpha = 0.15;
      for (let i = 1; i < ns.length; i++) { ctx.beginPath(); ctx.moveTo(ns[i - 1]!.x, ns[i - 1]!.y); ctx.lineTo(ns[i]!.x, ns[i]!.y); ctx.stroke(); }
      ctx.globalAlpha = 1;

      // nodes
      ctx.font = "10px 'Space Mono', monospace"; ctx.textAlign = "center";
      ns.forEach((n, i) => {
        const active = i === targetIdx % Math.max(ns.length, 1);
        ctx.strokeStyle = n.hot ? ORANGE : active ? CYAN : LINE;
        ctx.lineWidth = active ? 1.5 : 1;
        ctx.strokeRect(n.x - 46, n.y - 16, 92, 32);
        ctx.fillStyle = n.hot ? ORANGE : TEXT;
        ctx.fillText(n.label, n.x, n.y - 2);
        ctx.fillStyle = CYAN;
        ctx.fillText(`${n.price.toLocaleString()} sats`, n.x, n.y + 10);
      });

      // brain: walk → scan → next
      const goal = ns.length ? ns[targetIdx % ns.length]! : { x: W / 2 + Math.cos(time * 0.4) * W * 0.3, y: H / 2 + Math.sin(time * 0.7) * H * 0.25, hot: false, label: "" };
      const gx = goal.x, gy = goal.y - 34;
      const dx = gx - body.x, dy = gy - body.y, dist = Math.hypot(dx, dy);
      const speed = live ? 140 : 55;
      if (dist > 4) {
        const want = Math.atan2(dy, dx);
        let da = want - body.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        body.a += da * (1 - Math.exp(-6 * dt));
        const step = Math.min(dist, speed * dt);
        body.x += Math.cos(body.a) * step; body.y += Math.sin(body.a) * step;
      } else if (ns.length) {
        scan += dt;
        if (scan > (live ? 1.1 : 2)) { scan = 0; if (goal.hot) pounce = 0.6; targetIdx++; }
      }
      pounce = Math.max(0, pounce - dt);

      // scan laser
      if (scan > 0 && ns.length) {
        ctx.strokeStyle = goal.hot ? ORANGE : CYAN;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 30);
        ctx.beginPath(); ctx.moveTo(body.x + Math.cos(body.a) * 14, body.y + Math.sin(body.a) * 14); ctx.lineTo(gx, gy + 34); ctx.stroke();
        const sy = gy + 18 + (scan * 40) % 32;
        ctx.beginPath(); ctx.moveTo(gx - 46, sy); ctx.lineTo(gx + 46, sy); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (pounce > 0) {
        const r = 20 + (0.6 - pounce) * 60;
        ctx.strokeStyle = ORANGE; ctx.globalAlpha = pounce / 0.6;
        ctx.beginPath(); ctx.arc(gx, gy + 34, r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }

      // legs (two-segment IK, alternating gait)
      const cos = Math.cos(body.a), sin = Math.sin(body.a);
      const moving = dist > 4;
      legs.forEach((l, i) => {
        const la = body.a + l.side * (Math.PI / 2) + l.side * l.ang * -1;
        const restX = body.x + Math.cos(la) * 30 + cos * (moving ? 8 : 0);
        const restY = body.y + Math.sin(la) * 30 + sin * (moving ? 8 : 0);
        const groupTurn = Math.floor(time * (live ? 7 : 4)) % 2 === l.group;
        if (l.t >= 1 && groupTurn && Math.hypot(restX - l.fx, restY - l.fy) > 10) { l.sx = l.fx; l.sy = l.fy; l.t = 0; }
        if (l.t < 1) {
          l.t = Math.min(1, l.t + dt * 9);
          l.fx = l.sx + (restX - l.sx) * l.t; l.fy = l.sy + (restY - l.sy) * l.t;
        }
        const hx = body.x + Math.cos(la) * 8, hy = body.y + Math.sin(la) * 8;
        const lift = l.t < 1 ? Math.sin(l.t * Math.PI) * 6 : 0;
        const mx = (hx + l.fx) / 2 + Math.cos(la) * 4, my = (hy + l.fy) / 2 - 10 - lift;
        ctx.strokeStyle = TEXT; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx, my); ctx.lineTo(l.fx, l.fy); ctx.stroke();
        ctx.fillStyle = ORANGE; ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
        if (i === 0) ctx.lineWidth = 1;
      });

      // body
      ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.a);
      ctx.fillStyle = "rgba(10,14,20,0.95)"; ctx.strokeStyle = TEXT; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(-8, 0, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(8, 0, 8, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ORANGE; ctx.fillRect(-12, -1, 8, 2);
      ctx.fillStyle = CYAN; ctx.shadowColor = CYAN; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(12, -2.5, 1.6, 0, 7); ctx.arc(12, 2.5, 1.6, 0, 7); ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(frame);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) frame(performance.now()), cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="block h-[320px] w-full" aria-label="Spider hunter scanning live listings" />;
}
