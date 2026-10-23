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

export const STREAM_LOGOS = [
  "c47f5b4c6ef7351465f4ae4d88641fe77cab3303b0996fd4a0b7e9e5c645941fi0",
  "31e4ff9cb4cc970775c9ca4aa1d49af755900d7c15d2e7f2f6f715d62806fe5fi0",
];
/** Seconds of stream between breaks, and seconds each commercial slide shows. */
export const STREAM_SECONDS = 60;
export const SLIDE_SECONDS = 4;

const EMPORIUM = GALLERY_IDS.slice(0, 10);
const JIGGLY = GALLERY_IDS.slice(10);

type Slide = { id: string; tag: string };
/** One break: logo → Emporium → JIGGLYPUFF → logo, rotating through the pools each break. */
export function breakSlides(n: number): Slide[] {
  return [
    { id: STREAM_LOGOS[n % 2]!, tag: "BITMAP.STREAM" },
    { id: EMPORIUM[n % EMPORIUM.length]!, tag: "BITMAP EMPORIUM · 717328" },
    { id: JIGGLY[n % JIGGLY.length]!, tag: "JIGGLYPUFF" },
    { id: STREAM_LOGOS[(n + 1) % 2]!, tag: "BITMAP.STREAM" },
  ];
}

function Inscription({ id }: { id: string }) {
  const [src, setSrc] = useState(`https://ordinals.com/content/${id}`);
  const [frame, setFrame] = useState(false);
  useEffect(() => { setSrc(`https://ordinals.com/content/${id}`); setFrame(false); }, [id]);
  if (frame) return <iframe src={`https://ordinals.com/content/${id}`} title="inscription" sandbox="allow-scripts" style={{ border: 0, width: "100%", height: "100%", background: "#000" }} />;
  return <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }}
    onError={() => (src.startsWith("https://ordinals") ? setSrc(`/api/public/inscription/${id}`) : setFrame(true))} />;
}

export function CafeStreamTV({ position, width = 1.5 }: { position: [number, number, number]; width?: number }) {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const cycle = STREAM_SECONDS + 4 * SLIDE_SECONDS;
  const n = Math.floor(t / cycle), inCycle = t % cycle;
  const onBreak = inCycle >= STREAM_SECONDS;
  const slides = breakSlides(n);
  const slide = onBreak ? slides[Math.floor((inCycle - STREAM_SECONDS) / SLIDE_SECONDS)]! : null;
  const h = width * 9 / 16;
  return (
    <group position={position}>
      <mesh position-z={-0.03}><boxGeometry args={[width + 0.12, h + 0.12, 0.06]} /><meshStandardMaterial color="#1a1410" emissive="#f7931a" emissiveIntensity={0.15} /></mesh>
      <SafeHtml transform distanceFactor={400} position={[0, 0, 0.005]} scale={width / 640} zIndexRange={[10, 0]}>
        <div style={{ width: 640, height: 360, background: "#000", position: "relative", overflow: "hidden", font: "12px monospace" }}>
          <iframe src={G.embedUrl} title="Elevated Dabber on bitmap.stream" width={640} height={360} style={{ border: 0, display: "block" }} allow="autoplay; fullscreen" />
          {slide ? (
            <div style={{ position: "absolute", inset: 0, background: "#06090d" }}>
              <div style={{ position: "absolute", inset: "28px 0 28px 0" }}><Inscription id={slide.id} /></div>
              <div style={{ position: "absolute", top: 6, left: 10, color: "#f7931a" }}>● COMMERCIAL BREAK · {slide.tag}</div>
              <div style={{ position: "absolute", bottom: 6, left: 10, color: "#7fe7ff" }}>BACK TO @{G.handle} IN {cycle - inCycle}s</div>
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
