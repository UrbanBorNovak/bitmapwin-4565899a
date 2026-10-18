// Toon Studio art-style masks: a colour grade (CSS/canvas filter) plus a 2D texture pass.
// Both preview and export use the same filter string and painter, so the video matches the screen.

export type ToonStyle = "classic" | "manga" | "ghibli" | "shonen" | "noir" | "retro";

export const TOON_STYLES: { id: ToonStyle; label: string; filter: string }[] = [
  { id: "classic", label: "CLASSIC", filter: "none" },
  { id: "manga", label: "MANGA INK", filter: "grayscale(1) contrast(1.9) brightness(1.08)" },
  { id: "ghibli", label: "STORYBOOK (GHIBLI-LIKE)", filter: "saturate(1.25) sepia(0.18) brightness(1.08) contrast(0.92) hue-rotate(-6deg)" },
  { id: "shonen", label: "SHONEN POWER (GOKU-LIKE)", filter: "saturate(1.8) contrast(1.3) brightness(1.05)" },
  { id: "noir", label: "NOIR", filter: "grayscale(1) contrast(1.5) brightness(0.85)" },
  { id: "retro", label: "RETRO CARTOON", filter: "saturate(1.5) sepia(0.35) contrast(1.15)" },
];

export const styleFilter = (s?: ToonStyle) => TOON_STYLES.find((x) => x.id === s)?.filter ?? "none";

/** Paints the style's texture layer (screentone, paper grain, speed lines…) at time t. */
export function paintStyle(ctx: CanvasRenderingContext2D, w: number, h: number, style: ToonStyle | undefined, t: number) {
  if (!style || style === "classic") return;
  const u = Math.min(w, h) / 600;
  ctx.save();
  if (style === "manga" || style === "retro") {
    // Halftone screentone, denser toward the bottom.
    const g = Math.max(6, 9 * u);
    ctx.fillStyle = style === "manga" ? "rgba(0,0,0,0.22)" : "rgba(120,40,0,0.12)";
    for (let y = 0; y < h; y += g) for (let x = (y / g) % 2 ? g / 2 : 0; x < w; x += g) {
      const r = (g * 0.18) * (0.4 + y / h);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (style === "manga" || style === "noir") {
    ctx.strokeStyle = "#000"; ctx.lineWidth = 10 * u; ctx.strokeRect(0, 0, w, h);
  }
  if (style === "ghibli") {
    const gr = ctx.createRadialGradient(w * 0.3, h * 0.15, 0, w * 0.3, h * 0.15, Math.max(w, h));
    gr.addColorStop(0, "rgba(255,236,190,0.28)"); gr.addColorStop(1, "rgba(60,90,70,0.18)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    // Stable paper grain (seeded, no flicker).
    let a = 1234567;
    ctx.fillStyle = "rgba(90,60,30,0.08)";
    for (let i = 0; i < 1400; i++) {
      a = (a * 1103515245 + 12345) >>> 0; const x = (a % 10000) / 10000 * w;
      a = (a * 1103515245 + 12345) >>> 0; const y = (a % 10000) / 10000 * h;
      ctx.fillRect(x, y, 1.5 * u, 1.5 * u);
    }
  }
  if (style === "shonen") {
    // Radial speed lines flickering around a bright centre, gold aura at the edges.
    const cx = w / 2, cy = h / 2, R = Math.hypot(w, h);
    const n = 64, phase = Math.floor(t * 12);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < n; i++) {
      if ((i * 7 + phase) % 3 === 0) continue;
      const a0 = (i / n) * Math.PI * 2, da = 0.012 + ((i * 13 + phase) % 5) * 0.003;
      const r0 = R * (0.32 + ((i * 11 + phase) % 7) * 0.02);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
      ctx.lineTo(cx + Math.cos(a0 - da) * R, cy + Math.sin(a0 - da) * R);
      ctx.lineTo(cx + Math.cos(a0 + da) * R, cy + Math.sin(a0 + da) * R);
      ctx.fill();
    }
    const gr = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R * 0.6);
    gr.addColorStop(0, "rgba(255,200,40,0)"); gr.addColorStop(1, `rgba(255,170,20,${0.25 + Math.sin(t * 8) * 0.08})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  }
  if (style === "noir" || style === "ghibli" || style === "retro") {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, style === "noir" ? "rgba(0,0,0,0.6)" : "rgba(40,20,0,0.3)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
