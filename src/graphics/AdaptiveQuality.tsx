import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useQuality } from "./QualityContext";
import { reportFrame, reportRenderer } from "./useFps";

export function AdaptiveQuality() {
  const { quality, setAdaptiveScale } = useQuality();
  const invalidate = useThree((state) => state.invalidate);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const state = useRef({ lowFor: 0, highFor: 0, changedAt: -10, lastRender: 0, firstFrames: 0, firstTime: 0 });

  useEffect(() => {
    const onVisibility = () => {
      setFrameloop(document.hidden ? "never" : "always");
      if (!document.hidden) invalidate();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [invalidate, setFrameloop]);

  useFrame(({ gl, scene, camera, clock }, rawDelta) => {
    const now = clock.elapsedTime;
    const delta = Math.min(rawDelta, 0.25);
    reportFrame(delta);
    reportRenderer(gl.info.render.calls, gl.info.render.triangles, gl.getPixelRatio());
    if (!state.current.firstTime) state.current.firstTime = now;
    if (now - state.current.firstTime <= 3) state.current.firstFrames += 1;
    else if (quality.mode === "auto" && state.current.firstFrames / 3 < 40) setAdaptiveScale(0.5);

    const fps = 1 / Math.max(delta, 0.001);
    state.current.lowFor = fps < 25 ? state.current.lowFor + delta : 0;
    state.current.highFor = fps > 55 ? state.current.highFor + delta : 0;
    if (quality.adaptive && now - state.current.changedAt >= 2) {
      if (state.current.lowFor >= 2 && quality.renderScale > 0.5) {
        setAdaptiveScale(Math.max(0.5, quality.renderScale - 0.1));
        state.current.lowFor = 0;
        state.current.changedAt = now;
      } else if (state.current.highFor >= 5 && quality.resolved !== "low" && quality.renderScale < quality.maxRenderScale) {
        setAdaptiveScale(Math.min(quality.maxRenderScale, quality.renderScale + 0.05));
        state.current.highFor = 0;
        state.current.changedAt = now;
      }
    }
    if (document.hidden || now - state.current.lastRender < 1 / quality.fpsCap) return;
    state.current.lastRender = now;
    gl.render(scene, camera);
  }, 1000);
  return null;
}