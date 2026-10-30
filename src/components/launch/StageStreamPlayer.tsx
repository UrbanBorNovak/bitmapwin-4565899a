import { useEffect, useRef, useState } from "react";
import { GENESIS_BROADCASTER as G } from "@/lib/genesis-broadcaster";

/** Dabber's live HLS feed played by our own <video>, so the stage can unmute it with one click. */
export function StageStreamPlayer() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const src = `${G.channelUrl}/hls/stream.m3u8`;
    let hls: { destroy: () => void } | null = null;
    let dead = false;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = src; v.play().catch(() => {}); }
    else import("hls.js").then(({ default: Hls }) => {
      if (dead || !Hls.isSupported()) return;
      const h = new Hls({ liveDurationInfinity: true });
      h.loadSource(src); h.attachMedia(v); hls = h;
      v.play().catch(() => {});
    });
    return () => { dead = true; hls?.destroy(); };
  }, []);
  const toggle = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const v = ref.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted);
    if (!v.muted) { v.volume = 1; v.play().catch(() => {}); }
  };
  return (
    <>
      <video ref={ref} muted playsInline autoPlay style={{ width: 640, height: 360, display: "block", objectFit: "cover", background: "#000" }} />
      <button onPointerDown={toggle} style={{ position: "absolute", right: 12, bottom: 12, font: "bold 22px monospace", padding: "8px 16px", background: "rgba(0,0,0,0.75)", color: muted ? "#f7931a" : "#7fe7ff", border: `2px solid ${muted ? "#f7931a" : "#7fe7ff"}`, borderRadius: 4, cursor: "pointer", zIndex: 2 }}>
        {muted ? "🔇 UNMUTE" : "🔊 MUTE"}
      </button>
    </>
  );
}
