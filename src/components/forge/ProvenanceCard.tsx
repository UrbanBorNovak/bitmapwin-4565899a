import { useEffect, useRef } from "react";
import { toast } from "sonner";

export type ProvenanceParent = { label: string; kind: string; creator: string | null; ref: string };
type Props = {
  height: number;
  blocks: number;
  parents: ProvenanceParent[];
  payouts: { address: string; sats: number }[];
};

const W = 1200, H = 675;
// Fixed palette for the exported image only (matches the site's dark terminal look).
const C = { bg: "#07090d", panel: "#0d1218", line: "#1f2a35", orange: "#f7931a", cyan: "#3ee6ff", text: "#e7edf3", dim: "#7d8b99" };
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

function draw(cv: HTMLCanvasElement, p: Props) {
  const g = cv.getContext("2d")!;
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = C.line; g.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const box = (x: number, y: number, w: number, h: number, c = C.line) => { g.fillStyle = C.panel; g.fillRect(x, y, w, h); g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(x, y, w, h); };
  const t = (s: string, x: number, y: number, size: number, c = C.text, font = "Space Mono, monospace", weight = "") => { g.fillStyle = c; g.font = `${weight} ${size}px ${font}`.trim(); g.fillText(s, x, y); };

  g.fillStyle = C.orange; g.fillRect(40, 34, 36, 36); t("B", 49, 62, 28, C.bg, "Space Grotesk, sans-serif", "bold");
  t("BITMAPWIN", 90, 58, 24, C.orange, "Space Grotesk, sans-serif", "bold");
  t("REAL BUILDS · ON-CHAIN PROVENANCE · FAIR ROYALTIES", 700, 58, 14, C.cyan);
  t("HOW", 40, 128, 50, C.text, "Space Grotesk, sans-serif", "bold");
  t(`${p.height}.BITMAP`, 160, 128, 50, C.orange, "Space Grotesk, sans-serif", "bold");
  const tw = g.measureText(`${p.height}.BITMAP`).width;
  t("WAS BUILT", 180 + tw, 128, 50, C.text, "Space Grotesk, sans-serif", "bold");

  const shown = p.parents.slice(0, 3);
  const pw = 230, py = 170, ph = 190;
  shown.forEach((par, i) => {
    const x = 40 + i * (pw + 40);
    box(x, py, pw, ph, C.orange);
    t(`PARENT ${i + 1}`, x + 14, py + 28, 13, C.orange);
    t(par.label.slice(0, 18).toUpperCase(), x + 14, py + 62, 20, C.text, "Space Grotesk, sans-serif", "bold");
    t(par.kind.toUpperCase(), x + 14, py + 90, 13, C.dim);
    t(`CREATOR ${par.creator ? short(par.creator) : "—"}`, x + 14, py + 120, 13, C.text);
    t(short(par.ref), x + 14, py + 170, 12, C.dim);
    if (i < shown.length - 1) t("+", x + pw + 10, py + ph / 2 + 10, 30, C.orange, "Space Grotesk, sans-serif", "bold");
  });
  if (p.parents.length > 3) t(`+${p.parents.length - 3} MORE`, 40, py + ph + 24, 13, C.dim);
  const cx = 40 + Math.max(1, shown.length) * (pw + 40);
  t("→", cx - 34, py + ph / 2 + 12, 32, C.cyan, "Space Grotesk, sans-serif", "bold");
  const cw = W - 40 - cx;
  box(cx, py, cw, ph, C.cyan);
  t("COMBINED BUILD", cx + 14, py + 28, 13, C.cyan);
  t(`${p.height}.BITMAP`, cx + 14, py + 66, 26, C.text, "Space Grotesk, sans-serif", "bold");
  t(`${p.blocks.toLocaleString()} VOXELS`, cx + 14, py + 98, 14, C.dim);
  t(`${p.parents.length} PIECE${p.parents.length === 1 ? "" : "S"} REUSED`, cx + 14, py + 124, 14, C.dim);

  const ry = 400;
  box(40, ry, 760, 230);
  t("PROVENANCE & ROYALTIES", 58, ry + 32, 16, C.orange, "Space Grotesk, sans-serif", "bold");
  t("Paid to original creators inside the same Bitcoin transaction.", 58, ry + 56, 13, C.dim);
  const rows = p.payouts.slice(0, 6);
  if (!rows.length) t("No royalties — every piece in this build is original or free.", 58, ry + 100, 15, C.text);
  rows.forEach((r, i) => {
    const y = ry + 92 + i * 22;
    t(short(r.address), 58, y, 15, C.text);
    t(`${r.sats.toLocaleString()} sats`, 640, y, 15, C.orange);
  });
  const total = p.payouts.reduce((n, r) => n + r.sats, 0);
  box(830, ry, 330, 120, C.orange);
  t("TOTAL ROYALTIES", 850, ry + 34, 14, C.orange);
  t(`${total.toLocaleString()} sats`, 850, ry + 84, 36, C.text, "Space Grotesk, sans-serif", "bold");
  t("BUILD ON OTHERS.", 830, ry + 160, 22, C.text, "Space Grotesk, sans-serif", "bold");
  t("GIVE BACK.", 830, ry + 188, 22, C.orange, "Space Grotesk, sans-serif", "bold");
  t("bitmapwin.app/forge", 830, ry + 222, 14, C.cyan);
}

export function ProvenanceCard(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(props);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    void document.fonts?.ready.then(() => draw(cv, props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const total = props.payouts.reduce((n, r) => n + r.sats, 0);

  const download = () => {
    ref.current?.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = `${props.height}-bitmap-provenance.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  };
  const share = () => {
    download();
    const text = `HOW ${props.height}.BITMAP WAS BUILT\n\nComposed from ${props.parents.length} on-chain piece${props.parents.length === 1 ? "" : "s"}${total ? ` and paying ${total.toLocaleString()} sats in royalties straight to the original creators on Bitcoin L1` : ""}.\n\nBuild on others. Give back. @bitmapwin`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://bitmapwin.app/forge")}`, "_blank", "noopener");
    toast.success("IMAGE SAVED — ATTACH IT TO YOUR POST");
  };

  return (
    <div className="rounded border border-border bg-card/60 p-3">
      <p className="mb-2 font-mono text-xs text-primary">PROVENANCE CARD · 1200×675 FOR X</p>
      <canvas ref={ref} width={W} height={H} className="w-full rounded border border-border" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={download} className="min-h-11 rounded border border-border px-3 font-mono text-xs hover:border-accent">[ DOWNLOAD PNG ]</button>
        <button type="button" onClick={share} className="min-h-11 rounded border border-primary bg-primary/10 px-3 font-mono text-xs text-primary">[ SHARE TO X ]</button>
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">Shows only the pieces and royalty payouts in your current build. X can't attach images from a link, so the PNG downloads for you to add to the post.</p>
    </div>
  );
}
