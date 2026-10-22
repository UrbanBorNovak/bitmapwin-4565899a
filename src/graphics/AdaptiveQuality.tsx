import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useQuality } from "./QualityContext";
import { reportFrame, reportRenderer } from "./useFps";

export function AdaptiveQuality() {
  const { quality, setAdaptiveScale } = useQuality();
  const invalidate = useThree((state) => state.invalidate);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const state = useRef({ lowFor: 0, highFor: 0, changedAt: -10, lastRender: 0, firstFrames: 0, firstTime: 0, startupChecked: false, avg: 1 / 60 });

  const three = { gl: useThree((s) => s.gl), scene: useThree((s) => s.scene), camera: useThree((s) => s.camera) };
  useEffect(() => {
    // ?debug=1 exposes the renderer for in-sandbox profiling only.
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __oasisPerf?: unknown }).__oasisPerf = { gl: three.gl, scene: three.scene, camera: three.camera };
    }
  }, [three.gl, three.scene, three.camera]);

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
    // Smoothed frame time: one-off hitches (shader compile, texture upload)
    // must not count as a slow device.
    const s = state.current;
    s.avg += (Math.min(delta, 0.1) - s.avg) * 0.08;
    if (!s.firstTime) s.firstTime = now;
    // Warm-up: ignore the first 4 s, then benchmark the next 3 s.
    const since = now - s.firstTime;
    if (since > 4 && since <= 7) s.firstFrames += 1;
    else if (since > 7 && !s.startupChecked) {
      s.startupChecked = true;
      if (quality.mode === "auto" && s.firstFrames / 3 < 30) setAdaptiveScale(Math.max(0.6, quality.renderScale - 0.2));
    }

    const fps = 1 / Math.max(s.avg, 0.001);
    s.lowFor = fps < 52 ? s.lowFor + delta : 0;
    s.highFor = fps > 58 ? s.highFor + delta : 0;
    if (quality.adaptive && since > 4 && now - s.changedAt >= 1.5) {
      if (s.lowFor >= 1.5 && quality.renderScale > 0.5) {
        setAdaptiveScale(Math.max(0.5, quality.renderScale - 0.1));
        s.lowFor = 0;
        s.changedAt = now;
      } else if (s.highFor >= 6 && quality.resolved !== "low" && quality.renderScale < quality.maxRenderScale) {
        setAdaptiveScale(Math.min(quality.maxRenderScale, quality.renderScale + 0.05));
        s.highFor = 0;
        s.changedAt = now;
      }
    }
    // Small tolerance so a 60 Hz display never skips frames on jitter.
    if (document.hidden || now - s.lastRender < 1 / quality.fpsCap - 0.004) return;
    s.lastRender = now;
    gl.render(scene, camera);
  }, 1000);
  return null;
}