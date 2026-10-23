/**
 * Booth TV in the Bit-Café: Elevated Dabber's bitmap.stream channel with timed
 * commercial breaks made of real inscriptions (bitmap.stream logos, Bitmap
 * Emporium portraits, JIGGLYPUFFs). The stream iframe stays mounted under the
 * break so it never reloads.
 */
import { useEffect, useState } from "react";
import { SafeHtml } from "@/components/game/SafeHtml";
import { GENESIS_BROADCASTER as G } from "@/lib/genesis-broadcaster";
import { GALLERY_IDS } from "@/components/toon/EcoGallery";
import { listSponsorSlidesFn, type SponsorSlide } from "@/lib/sponsor-slots.functions";
import { slotLive } from "@/lib/sponsor-slots";

export const STREAM_LOGOS = [
  "c47f5b4c6ef7351465f4ae4d88641fe77cab3303b0996fd4a0b7e9e5c645941fi0",
  "31e4ff9cb4cc970775c9ca4aa1d49af755900d7c15d2e7f2f6f715d62806fe5fi0",
];
/** Seconds of stream between breaks, and seconds each commercial slide shows. */
export const STREAM_SECONDS = 60;
export const SLIDE_SECONDS = 4;

const EMPORIUM = GALLERY_IDS.slice(0, 10);
const JIGGLY = GALLERY_IDS.slice(10);

type Slide = { id: string; tag: string; image?: string };
/** One break: logo → Emporium → JIGGLYPUFF → logo, rotating through the pools each break. */
export function breakSlides(n: number): Slide[] {
  return [
    { id: STREAM_LOGOS[n % 2]!, tag: "BITMAP.STREAM" },
    { id: EMPORIUM[n % EMPORIUM.length]!, tag: "BITMAP EMPORIUM · 717328" },
    { id: JIGGLY[n % JIGGLY.length]!, tag: "JIGGLYPUFF" },
    { id: STREAM_LOGOS[(n + 1) % 2]!, tag: "BITMAP.STREAM" },
  ];
}

/** Paid café slots take the closing logo's place, rotating each break. */
export function withSponsors(slides: Slide[], sponsors: SponsorSlide[], n: number): Slide[] {
  if (!sponsors.length) return slides;
  const s = sponsors[n % sponsors.length]!;
  const tag = `SPONSORED · ${s.title}${s.handle ? ` · ${s.handle}` : ""}`;
  const out = slides.slice();
  out[3] = s.kind === "inscription" ? { id: s.media, tag } : { id: "", image: s.media, tag };
  return out;
}

function Inscription({ id }: { id: string }) {
  const [src, setSrc] = useState(`https://ordinals.com/content/${id}`);
  const [frame, setFrame] = useState(false);
  useEffect(() => { setSrc(`https://ordinals.com/content/${id}`); setFrame(false); }, [id]);
  if (frame) return <iframe src={`https://ordinals.com/content/${id}`} title="inscription" sandbox="allow-scripts" style={{ border: 0, width: "100%", height: "100%", background: "#000" }} />;
  return <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }}
    onError={() => (src.startsWith("https://ordinals") ? setSrc(`/api/public/inscription/${id}`) : setFrame(true))} />;
}

export function CafeStreamTV({ position, rotationY = 0, width = 1.5 }: { position: [number, number, number]; rotationY?: number; width?: number }) {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const [sponsors, setSponsors] = useState<SponsorSlide[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => listSponsorSlidesFn().then((r) => live && setSponsors(r.slides)).catch(() => {});
    void load(); const i = setInterval(load, 300_000);
    return () => { live = false; clearInterval(i); };
  }, []);
  const cycle = STREAM_SECONDS + 4 * SLIDE_SECONDS;
  const n = Math.floor(t / cycle), inCycle = t % cycle;
  const onBreak = inCycle >= STREAM_SECONDS;
  const now = Date.now();
  const slides = withSponsors(breakSlides(n), sponsors.filter((x) => slotLive(x, "cafe", now)), n);
  const slide = onBreak ? slides[Math.floor((inCycle - STREAM_SECONDS) / SLIDE_SECONDS)]! : null;
  const h = width * 9 / 16;
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position-z={-0.03}><boxGeometry args={[width + 0.12, h + 0.12, 0.06]} /><meshStandardMaterial color="#1a1410" emissive="#f7931a" emissiveIntensity={0.15} /></mesh>
      <SafeHtml transform distanceFactor={400} position={[0, 0, 0.005]} scale={width / 640} zIndexRange={[10, 0]}>
        <div style={{ width: 640, height: 360, background: "#000", position: "relative", overflow: "hidden", font: "12px monospace" }}>
          <iframe src={G.embedUrl} title="Elevated Dabber on bitmap.stream" width={640} height={360} style={{ border: 0, display: "block" }} allow="autoplay; fullscreen" />
          {slide ? (
            <div style={{ position: "absolute", inset: 0, background: "#06090d" }}>
              <div style={{ position: "absolute", inset: "28px 0 28px 0" }}>{slide.image ? <img src={slide.image} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Inscription id={slide.id} />}</div>
              <div style={{ position: "absolute", top: 6, left: 10, color: "#f7931a" }}>● COMMERCIAL BREAK · {slide.tag}</div>
              <div style={{ position: "absolute", bottom: 6, left: 10, color: "#7fe7ff" }}>BACK TO @{G.handle} IN {cycle - inCycle}s</div>
              <div style={{ position: "absolute", bottom: 6, right: 10, color: "#9aa4ad" }}>SPONSOR THIS SCREEN · BITMAPWIN.APP/LAUNCH</div>
            </div>
          ) : (
            <div style={{ position: "absolute", top: 6, left: 10, color: "#f7931a", pointerEvents: "none", textShadow: "0 0 4px #000" }}>● LIVE · @{G.handle} · {G.channelHeight}.BITMAP</div>
          )}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0 2px, transparent 2px 4px)" }} />
        </div>
      </SafeHtml>
    </group>
  );
}
