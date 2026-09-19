import { useMemo } from "react";
import { useFps } from "./useFps";
import { useQuality } from "./QualityContext";

export function GraphicsDebug() {
  const stats = useFps();
  const { quality } = useQuality();
  const enabled = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1", []);
  if (!enabled) return null;
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return <aside data-no-translate className="hud-panel pointer-events-none absolute bottom-3 right-3 z-[70] grid grid-cols-[auto_auto] gap-x-3 px-2 py-1 font-mono text-[9px] tabular-nums">
    <span className="hud-telemetry-title col-span-2">RENDER DEBUG</span>
    <span>PRESET</span><span>{quality.mode.toUpperCase()} / {quality.resolved.toUpperCase()}</span>
    <span>FPS</span><span>{stats.fps.toFixed(0)} · {stats.frameMs.toFixed(1)}MS</span>
    <span>PIXEL RATIO</span><span>{stats.pixelRatio.toFixed(2)}</span>
    <span>RENDER SCALE</span><span>{Math.round(quality.renderScale * 100)}%</span>
    <span>DRAW CALLS</span><span>{stats.drawCalls}</span>
    <span>TRIANGLES</span><span>{stats.triangles.toLocaleString()}</span>
    {memory ? <><span>HEAP</span><span>{Math.round(memory.usedJSHeapSize / 1048576)}MB</span></> : null}
  </aside>;
}