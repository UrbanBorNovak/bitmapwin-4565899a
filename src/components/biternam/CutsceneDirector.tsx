/** Cinematic Director: useCutscene() plays keyframes; <CutsceneStage> wraps the room view with camera push, letterbox, lights and subtitles. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cutsceneLength, frameAt, type Cutscene } from "@/lib/cutscene";
import { playSfx } from "@/lib/retro-sfx";
import { PixelFace } from "@/components/game/PixelFace";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";

export function useCutscene() {
  const [scene, setScene] = useState<Cutscene | null>(null);
  const [frame, setFrame] = useState(-1);
  const start = useRef(0);
  const play = useCallback((c: Cutscene | undefined) => { if (!c) return; start.current = performance.now(); setScene(c); setFrame(0); }, []);
  const skip = useCallback(() => { setScene(null); setFrame(-1); }, []);
  useEffect(() => {
    if (!scene) return;
    let raf = 0;
    const tick = () => {
      const i = frameAt(scene, performance.now() - start.current);
      if (i < 0) { skip(); return; }
      setFrame((p) => (p === i ? p : i));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") skip(); };
    window.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", key); };
  }, [scene, skip]);
  const kf = scene && frame >= 0 ? scene.frames[frame] : null;
  useEffect(() => { if (kf?.sfx) playSfx(kf.sfx); }, [kf]);
  return { active: !!kf, kf, play, skip, total: scene ? cutsceneLength(scene) : 0 };
}

type Cut = ReturnType<typeof useCutscene>;
const LIGHT: Record<string, string> = {
  spot: "radial-gradient(circle at 50% 50%, transparent 22%, color-mix(in oklch, var(--background) 75%, transparent) 60%)",
  dim: "color-mix(in oklch, var(--background) 45%, transparent)",
  flash: "color-mix(in oklch, var(--foreground) 35%, transparent)",
  warm: "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)",
  cold: "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--signal) 18%, transparent), transparent 70%)",
};

export function CutsceneStage({ cut, children }: { cut: Cut; children: ReactNode }) {
  const kf = cut.kf;
  const [fx, fy] = kf?.focus ?? [50, 50];
  const z = kf?.zoom ?? 1;
  const face = kf?.face ? CREW_PIXEL_AVATAR[kf.face] : undefined;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className={`h-full w-full ${kf?.shake ? "animate-[cut-shake_0.12s_infinite]" : ""}`}
        style={{ transformOrigin: `${fx}% ${fy}%`, transform: `scale(${z})`, transition: "transform 1.1s cubic-bezier(.65,0,.35,1)", pointerEvents: cut.active ? "none" : undefined }}>
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-500" style={{ background: kf?.light ? LIGHT[kf.light] : "transparent", opacity: kf?.light ? 1 : 0 }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-background transition-all duration-500" style={{ height: cut.active ? "11%" : 0 }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background transition-all duration-500" style={{ height: cut.active ? "11%" : 0 }} />
      {kf ? (
        <>
          <button onClick={cut.skip} className="absolute right-4 top-3 z-20 font-mono text-[11px] tracking-widest text-muted-foreground hover:text-signal">[ ESC ] SKIP</button>
          {kf.line ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[3%] z-20 flex justify-center px-4">
              <div key={kf.line} className="flex max-w-xl items-center gap-3 font-mono animate-[passport-reveal_0.4s_ease-out]">
                {face ? <PixelFace inscriptionId={face} label={kf.speaker ?? ""} className="h-10 w-10 shrink-0 rounded border border-border" /> : null}
                <div>
                  {kf.speaker ? <div className="text-[11px] tracking-[0.3em] text-primary">{kf.speaker}</div> : null}
                  <div className="text-sm text-foreground sm:text-base">{kf.line}</div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
