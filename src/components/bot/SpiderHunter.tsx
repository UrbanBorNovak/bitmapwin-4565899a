import { useEffect, useRef } from "react";

export type HuntTarget = { id: string; label: string; price: number; hot?: boolean; parcels?: { x: number; y: number; size: number }[]; grid?: number };

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
      const S = 56;
      ns.forEach((n, i) => {
        const active = i === targetIdx % Math.max(ns.length, 1);
        const x0 = n.x - S / 2, y0 = n.y - S / 2 - 8;
        ctx.fillStyle = "#000"; ctx.fillRect(x0, y0, S, S);
        if (n.parcels && n.grid) {
          const u = S / n.grid;
          ctx.fillStyle = n.hot ? ORANGE : "#f2f2f2";
          for (const p of n.parcels) ctx.fillRect(x0 + p.x * u + u * 0.08, y0 + p.y * u + u * 0.08, p.size * u - u * 0.16, p.size * u - u * 0.16);
        } else {
          ctx.fillStyle = TEXT; ctx.fillText("SYNC", n.x, n.y - 6);
        }
        ctx.strokeStyle = n.hot ? ORANGE : active ? CYAN : LINE;
        ctx.lineWidth = active ? 2 : 1;
        ctx.strokeRect(x0 - 1, y0 - 1, S + 2, S + 2);
        ctx.fillStyle = n.hot ? ORANGE : TEXT;
        ctx.fillText(n.label, n.x, y0 + S + 12);
        ctx.fillStyle = CYAN;
        ctx.fillText(`${n.price.toLocaleString()} sats`, n.x, y0 + S + 24);
      });

      // brain: walk → scan → next
      const goal = ns.length ? ns[targetIdx % ns.length]! : { x: W / 2 + Math.cos(time * 0.4) * W * 0.3, y: H / 2 + Math.sin(time * 0.7) * H * 0.25, hot: false, label: "" };
      const gx = goal.x, gy = goal.y - 70;
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
        ctx.beginPath(); ctx.moveTo(body.x + Math.cos(body.a) * 14, body.y + Math.sin(body.a) * 14); ctx.lineTo(gx, gy + 62); ctx.stroke();
        const sy = gy + 34 + (scan * 50) % 56;
        ctx.beginPath(); ctx.moveTo(gx - 28, sy); ctx.lineTo(gx + 28, sy); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (pounce > 0) {
        const r = 20 + (0.6 - pounce) * 60;
        ctx.strokeStyle = ORANGE; ctx.globalAlpha = pounce / 0.6;
        ctx.beginPath(); ctx.arc(gx, gy + 62, r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
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
        const vox = (ax: number, ay: number, bx: number, by: number, sz: number, c: string) => {
          const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / (sz * 0.9)));
          for (let k = 0; k <= n; k++) {
            const px = ax + ((bx - ax) * k) / n, py = ay + ((by - ay) * k) / n;
            ctx.fillStyle = c; ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
            ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(Math.round(px - sz / 2), Math.round(py + sz / 2 - 1), sz, 1);
          }
        };
        vox(hx, hy, mx, my, 4, ORANGE);
        vox(mx, my, l.fx, l.fy, 3, "#c96d08");
        void i;
      });

      // body
      ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.a);
      const B = 4;
      const shape: [number, number, string][] = [];
      for (let gx2 = -5; gx2 <= 1; gx2++) for (let gy2 = -2; gy2 <= 2; gy2++)
        if ((gx2 / 3.6) ** 2 + (gy2 / 2.6) ** 2 <= 1.05) shape.push([gx2 - 1, gy2, (gx2 + gy2) % 2 ? ORANGE : "#e6810e"]);
      for (let gx2 = 1; gx2 <= 3; gx2++) for (let gy2 = -1; gy2 <= 1; gy2++) shape.push([gx2, gy2, "#ffb45a"]);
      for (const [vx, vy, c] of shape) {
        ctx.fillStyle = c; ctx.fillRect(vx * B - B / 2, vy * B - B / 2, B, B);
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.5; ctx.strokeRect(vx * B - B / 2, vy * B - B / 2, B, B);
      }
      ctx.fillStyle = CYAN; ctx.shadowColor = CYAN; ctx.shadowBlur = 8;
      ctx.fillRect(3.5 * B, -1.5 * B, 3, 3); ctx.fillRect(3.5 * B, 0.8 * B, 3, 3);
      ctx.restore();

      raf = requestAnimationFrame(frame);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) frame(performance.now()), cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="block h-[380px] w-full" aria-label="Spider hunter scanning live listings" />;
}
