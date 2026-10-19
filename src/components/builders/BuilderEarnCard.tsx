import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Export image uses a fixed brand palette so the PNG looks identical in any site theme.
const C = { bg: "#07090d", panel: "#0d1218", line: "#1f2a35", orange: "#f7931a", cyan: "#3ee6ff", text: "#e7edf3", dim: "#7d8b99" };

const STEPS = [
  { n: "01", t: "CREATE", b: ["Voxel pieces, kits, extenders,", "episodes — in free studios."], tag: "FREE", c: C.cyan },
  { n: "02", t: "PUBLISH", b: ["Each stamp of your Forge", "module pays a BIT royalty."], tag: "BIT", c: C.cyan },
  { n: "03", t: "GET PAID IN SATS", b: ["Builds using your piece pay", "you in the reveal tx (≥546 sats)."], tag: "ON-CHAIN", c: C.orange },
  { n: "04", t: "HOST & EARN", b: ["Host on your BITMAP, share", "the daily visitor dividend."], tag: "BIT", c: C.cyan },
];

function draw(cv: HTMLCanvasElement) {
  cv.width = 1200; cv.height = 675;
  const g = cv.getContext("2d")!;
  const t = (s: string, x: number, y: number, size: number, c = C.text, font = "Space Mono, monospace", w = "") => {
    g.fillStyle = c; g.font = `${w} ${size}px ${font}`.trim(); g.fillText(s, x, y);
  };
  g.fillStyle = C.bg; g.fillRect(0, 0, 1200, 675);
  g.strokeStyle = C.line; g.lineWidth = 1;
  for (let x = 0; x < 1200; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 675); g.stroke(); }
  for (let y = 0; y < 675; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }
  t("BITMAPWIN · BUILDERS", 60, 70, 18, C.orange);
  t("HOW BUILDERS EARN ON BITCOIN", 60, 128, 46, C.text, "Space Grotesk, sans-serif", "700");
  t("From block to income — paid by Bitcoin itself.", 60, 166, 20, C.dim, "DM Sans, sans-serif");
  const w = 250, gap = 30, y = 220, h = 300;
  STEPS.forEach((s, i) => {
    const x = 60 + i * (w + gap);
    g.fillStyle = C.panel; g.fillRect(x, y, w, h);
    g.strokeStyle = s.c; g.strokeRect(x + 0.5, y + 0.5, w, h);
    t(s.n, x + 20, y + 64, 48, C.orange, "Space Grotesk, sans-serif", "700");
    g.strokeStyle = s.c; g.strokeRect(x + w - 112, y + 26, 92, 28);
    g.textAlign = "center"; t(s.tag, x + w - 66, y + 45, 13, s.c); g.textAlign = "left";
    t(s.t, x + 20, y + 130, 22, C.text, "Space Grotesk, sans-serif", "700");
    s.b.forEach((l, k) => t(l, x + 20, y + 170 + k * 26, 16, C.dim, "DM Sans, sans-serif"));
    if (i < STEPS.length - 1) t("→", x + w + 4, y + h / 2 + 8, 24, C.orange);
  });
  g.fillStyle = C.orange; g.fillRect(60, 560, 1080, 2);
  t("BUILD ON OTHERS. GIVE BACK. COMPOSABILITY CREATES VALUE.", 60, 600, 18, C.text);
  t("bitmapwin.app/builders", 60, 632, 16, C.cyan);
}

export function BuilderEarnCard() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    draw(cv);
    void document.fonts?.ready.then(() => draw(cv));
  }, []);
  const download = () => {
    const a = document.createElement("a");
    a.href = ref.current!.toDataURL("image/png");
    a.download = "bitmap-builder-earnings.png";
    document.body.appendChild(a); a.click(); a.remove();
  };
  const share = () => {
    download();
    const text = "How builders earn on Bitcoin: create → publish → get paid in sats by the reveal tx → host & earn. #BITMAP";
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://bitmapwin.app/builders")}`, "_blank", "noopener");
    toast.success("IMAGE SAVED — ATTACH IT TO YOUR POST");
  };
  return (
    <div className="mt-6 border border-border bg-surface p-4">
      <p className="label mb-2 text-bitcoin">EARNINGS INFOGRAPHIC · 1200×675 FOR X</p>
      <canvas ref={ref} className="block h-auto w-full border border-border" aria-label="Builder earnings infographic" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={download} className="btn-term-ghost">[ DOWNLOAD PNG ]</button>
        <button type="button" onClick={share} className="btn-term">[ SHARE TO X ]</button>
      </div>
      <p className="label mt-2 text-muted-foreground">X can't attach images from a link — the PNG downloads so you can add it to your post.</p>
    </div>
  );
}
