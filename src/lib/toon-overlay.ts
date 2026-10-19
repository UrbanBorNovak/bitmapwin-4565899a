import { sceneAt, transitionAt, type ToonEpisode } from "@/lib/toon-script";
import { paintStyle } from "@/lib/toon-style";
import { placeBubble, toonEmotes, toonHeads, type Rect } from "@/lib/toon-anchors";

/** Draws title card, captions and comic bubbles onto a 2D context (shared by screen + recording). */
export function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, ep: ToonEpisode, t: number,
  toPx: (nx: number, ny: number) => [number, number] = (nx, ny) => [nx * w, ny * h]) {
  ctx.clearRect(0, 0, w, h);
  paintStyle(ctx, w, h, ep.style, t);
  const { index, local } = sceneAt(ep, t);
  const s = ep.scenes[index];
  if (!s) return;
  const u = Math.min(w, h) / 600;
  ctx.textBaseline = "middle";
  // Title card on the first two seconds.
  if (t < 2.2) {
    ctx.globalAlpha = Math.min(1, (2.2 - t) * 2);
    ctx.fillStyle = "rgba(10,14,20,0.75)";
    ctx.fillRect(0, h * 0.38, w, h * 0.24);
    ctx.fillStyle = "#f7931a";
    ctx.font = `bold ${36 * u}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(ep.title.toUpperCase(), w / 2, h / 2);
    ctx.globalAlpha = 1;
  }
  const taken: Rect[] = [];
  // Emote icons are obstacles: bubbles are placed so they never cover them.
  for (const e of toonEmotes.values()) {
    if (e.scene !== index) continue;
    const [cx, cy] = toPx(e.x, e.y), [, ey] = toPx(e.x, e.y + e.r), r = Math.abs(ey - cy) * 1.15 + 4;
    taken.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 });
  }
  for (const l of s.lines) {
    if (local < l.at || local > l.at + l.dur) continue;
    const pop = Math.min(1, (local - l.at) * 6);
    const left = l.speaker % 2 === 0;
    ctx.font = `bold ${22 * u}px 'DM Sans', sans-serif`;
    ctx.textAlign = "left";
    const words = l.text.split(" "), lines: string[] = [], maxW = w * 0.34;
    let cur = "";
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = word; } else cur = next;
    }
    lines.push(cur);
    const lh = 28 * u, bw = Math.max(...lines.map((x) => ctx.measureText(x).width)) + 36 * u, bh = lines.length * lh + 28 * u;
    // Anchor beside the speaking Guardian's head; fall back to a corner if it isn't on screen.
    const a = toonHeads.get(l.speaker);
    const head = a && a.scene === index && a.x > -0.1 && a.x < 1.1 && a.y > -0.1 && a.y < 1.1 ? toPx(a.x, a.y) : null;
    const margin = 14 * u, nameH = 20 * u, gap = 40 * u;
    const r = head
      ? placeBubble(head[0], head[1], bw, bh + nameH, w, h, gap, margin, taken)
      : placeBubble(left ? margin + bw / 2 : w - margin - bw / 2, h * 0.12 + bh + nameH + gap, bw, bh + nameH, w, h, gap, margin, taken);
    taken.push(r);
    const bx = r.x, by = r.y + nameH;
    ctx.save();
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.scale(pop, pop);
    ctx.translate(-(bx + bw / 2), -(by + bh / 2));
    ctx.fillStyle = l.style === "shout" ? "#fff3c4" : "#ffffff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, l.style === "thought" ? bh / 2 : 14 * u);
    ctx.fill(); ctx.stroke();
    // Tail points at the speaker's head (capped length), from whichever bubble edge faces it.
    const hx = head ? head[0] : left ? bx + bw * 0.3 : bx + bw * 0.7, hy = head ? head[1] : by + bh + 60 * u;
    const below = hy > by + bh / 2, ex = below ? by + bh - 2 : by + 2;
    const tx = Math.max(bx + 22 * u, Math.min(bx + bw - 22 * u, hx));
    const dx = hx - tx, dy = hy - ex, len = Math.hypot(dx, dy) || 1, tl = Math.min(34 * u, Math.max(14 * u, len - 8 * u));
    ctx.beginPath();
    ctx.moveTo(tx - 12 * u, ex); ctx.lineTo(tx + (dx / len) * tl, ex + (dy / len) * tl); ctx.lineTo(tx + 12 * u, ex);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#111";
    lines.forEach((x, i) => ctx.fillText(x, bx + 18 * u, by + 14 * u + lh * (i + 0.5)));
    const who = s.cast[l.speaker]?.name;
    if (who) {
      ctx.font = `bold ${13 * u}px 'Space Mono', monospace`;
      ctx.lineWidth = 3 * u; ctx.strokeStyle = "rgba(10,14,20,0.85)";
      ctx.strokeText(who.toUpperCase(), bx + 18 * u, by - 10 * u);
      ctx.fillStyle = "#f7931a"; ctx.fillText(who.toUpperCase(), bx + 18 * u, by - 10 * u);
    }
    ctx.restore();
  }
  if (s.sfx && local > 0.3 && local < 1.6) {
    ctx.save();
    ctx.translate(w * 0.5, h * 0.7);
    ctx.rotate(-0.15);
    ctx.scale(1 + (1.6 - local) * 0.3, 1 + (1.6 - local) * 0.3);
    ctx.font = `900 ${64 * u}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 8 * u;
    ctx.strokeStyle = "#111";
    ctx.strokeText(s.sfx, 0, 0);
    ctx.fillStyle = "#f7931a";
    ctx.fillText(s.sfx, 0, 0);
    ctx.restore();
  }
  ctx.font = `${12 * u}px 'Space Mono', monospace`;
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${s.block}.BITMAP · SCENE ${index + 1}/${ep.scenes.length}`, w - 12 * u, h - 16 * u);
  paintTransition(ctx, w, h, ep, t);
}

/** Scene transitions drawn over everything (stage, bubbles) so preview and export match. */
function paintTransition(ctx: CanvasRenderingContext2D, w: number, h: number, ep: ToonEpisode, t: number) {
  const tr = transitionAt(ep, t);
  if (!tr || tr.k <= 0) return;
  const k = tr.k * tr.k * (3 - 2 * tr.k);
  ctx.save();
  ctx.fillStyle = "#0a0a0f";
  if (tr.kind === "fade") { ctx.globalAlpha = k; ctx.fillRect(0, 0, w, h); }
  else if (tr.kind === "wipe") {
    const edge = tr.opening ? w * (1 - k) : w * k, x0 = tr.opening ? w - edge : 0;
    ctx.fillRect(x0, 0, edge, h);
    ctx.fillStyle = "#f7931a";
    const ex = tr.opening ? x0 : edge;
    for (let y = 0; y < h; y += 14) { ctx.beginPath(); ctx.arc(ex, y + 7, 5 * k + 1, 0, Math.PI * 2); ctx.fill(); }
  } else if (tr.kind === "iris") {
    const r = Math.hypot(w, h) * 0.55 * (1 - k);
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.arc(w / 2, h / 2, Math.max(0.1, r), 0, Math.PI * 2, true); ctx.fill("evenodd");
  }
  ctx.restore();
}
