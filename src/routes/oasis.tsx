import { ShardRaidHud } from "@/components/game/ShardRaidHud";
import { SnapShare } from "@/components/game/SnapShare";
import { DropHud } from "@/components/game/DropHud";
import { AdrenalineBot } from "@/components/game/AdrenalineBot";
import { GuardianRadar } from "@/components/game/GuardianRadar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, Maximize2, Minimize2, Palette } from "lucide-react";
import { OasisVisualModsPanel, modStyle, useVisualMod, useModsHotkey } from "@/components/game/OasisVisualMods";
import { getChainBlocks } from "@/lib/chain.functions";
import { OasisWorldGuard } from "@/components/OasisWorldGuard";
import { OasisEntry } from "@/components/game/OasisEntry";
import { ClassSkillBar } from "@/components/game/ClassSkillBar";
import { RacePicker } from "@/components/game/RacePicker";
import { OasisTradeTicker } from "@/components/game/OasisTradeTicker";
import { OasisBroadcastControl } from "@/components/game/OasisBroadcastControl";
import { Button } from "@/components/ui/button";
import { OasisControlsHint } from "@/components/game/OasisControlsHint";

const BitmapWorld3D = lazy(() => import("@/components/BitmapWorld3D").then((module) => ({ default: module.BitmapWorld3D })));

export const Route = createFileRoute("/oasis")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { height?: number } => {
    const height = Number(search["height"]);
    return Number.isInteger(height) && height >= 0 && height < 1_000_000 ? { height } : {};
  },
  head: ({ match }) => {
    const h = (match.search as { height?: number }).height ?? 0;
    const title = `${h}.BITMAP in The Oasis — Bitcoin-native world`;
    const description =
      "Walk and fly through every Bitcoin block as a shared 3D world. Visit BITMAP districts, find community builds, join Shard Raids and meet Guardians.";
    const player = `https://bitmapwin.app/embed/oasis?height=${h}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `https://bitmapwin.app/oasis?height=${h}` },
        { name: "twitter:card", content: "player" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:player", content: player },
        { name: "twitter:player:width", content: "1280" },
        { name: "twitter:player:height", content: "720" },
      ],
    };
  },
  component: OasisPage,
});

function OasisPage() {
  const { height } = Route.useSearch();
  // Deep links skip the story and drop straight into the world.
  const [entered, setEntered] = useState(height !== undefined);
  const [mod, setMod] = useVisualMod();
  const [modsOpen, setModsOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const [fallbackFs, setFallbackFs] = useState(false);
  const fullscreen = nativeFs || fallbackFs;
  useEffect(() => {
    const onChange = () => setNativeFs(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!fallbackFs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFallbackFs(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fallbackFs]);
  const toggleFullscreen = () => {
    if (fallbackFs) return setFallbackFs(false);
    if (document.fullscreenElement) return void document.exitFullscreen();
    const el = shellRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => setFallbackFs(true));
    else setFallbackFs(true);
  };
  const toggleMods = useCallback(() => setModsOpen((v) => !v), []);
  useModsHotkey(toggleMods);
  const [cinematic, setCinematic] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [hintNonce, setHintNonce] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "`" && !e.ctrlKey && !e.metaKey && !e.altKey) setCinematic((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const fetchBlocks = useServerFn(getChainBlocks);
  const tip = useQuery({
    queryKey: ["chain", "tip", "map"],
    queryFn: async () => {
      const blocks = await fetchBlocks({ data: { pages: 1, scan: false } });
      return Math.max(...blocks.map((b) => b.height));
    },
    staleTime: 60_000,
  });

  const tipHeight = tip.data ?? 0;
  const legend = (
    <>
      <span className="hud-telemetry-title mr-1">MAP SIGNALS</span>
      <span className="legend-chip" role="listitem">
        <span className="legend-swatch bg-foreground" /> MINED · UNCLAIMED
      </span>
      <span className="legend-chip" role="listitem">
        <span className="legend-swatch bg-border" /> NOT MINED YET
      </span>
      <span className="legend-chip" role="listitem">
        <span className="legend-swatch bg-bitcoin" /> HELD BY YOU
      </span>
      <span className="legend-chip" role="listitem">
        <span className="flex items-center gap-0.5">
          <span className="legend-swatch bg-signal" />
          <span className="legend-swatch bg-bitcoin" />
          <span className="legend-swatch bg-foreground" />
        </span>
        ONE COLOUR PER HOLDER
      </span>
    </>
  );

  return (
    <div className="px-0 pb-0 sm:px-2 sm:pb-2 md:px-3">
      <h1 className="sr-only">The Oasis</h1>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-x border-t border-border px-3 py-2">
        <p className="label min-w-0 text-signal">OASIS WORLD · LIVE</p>
        <span className="flex shrink-0 items-center gap-3">
          {entered ? <button type="button" onClick={() => setHintNonce((n) => n + 1)} className="label text-signal hover:text-bitcoin">[?] CONTROLS</button> : null}
          <Link to="/play-guide" className="label text-bitcoin hover:text-foreground">GUIDE →</Link>
        </span>
      </div>
      <div
        ref={shellRef}
        data-tour="map-world"
        style={modStyle(mod)}
        className={`oasis-modded relative min-w-0 ${fullscreen ? "oasis-fs" : ""} ${fallbackFs ? "oasis-fs-fallback" : ""} ${cinematic ? "oasis-cinematic" : ""}`}
      >
        {!entered ? (
          <OasisEntry onEnter={() => setEntered(true)} />
        ) : (
        <OasisWorldGuard>
        <Suspense fallback={<div className="grid h-[78vh] min-h-[520px] place-items-center border border-border bg-background font-mono text-xs text-signal">INITIALIZING OASIS RENDERER…</div>}>
          <div className="relative">
            <div className="oasis-page-tools flex justify-end gap-2 border-b border-border py-2">
              <Button variant="terminalGhost" size="icon" type="button" aria-label={cinematic ? "Show HUD" : "Cinematic view"} title={cinematic ? "Show HUD (`)" : "Cinematic view (`)"} onClick={() => setCinematic((v) => !v)} className={`hud-panel hud-keep grid size-11 place-items-center ${cinematic ? "text-bitcoin" : "text-signal"} hover:text-bitcoin`}>
                {cinematic ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </Button>
              <SnapShare height={height ?? 0} />
              <Button variant="terminalGhost" size="icon" type="button" aria-label="Visual mods" title="Visual mods" onClick={() => setModsOpen((v) => !v)} className={`hud-panel hud-keep grid size-11 place-items-center ${modsOpen ? "text-bitcoin" : "text-signal"} hover:text-bitcoin`}>
                <Palette className="size-4" />
              </Button>
              <Button variant="terminalGhost" size="icon" type="button" aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen} className="hud-panel hud-keep grid size-11 place-items-center text-signal hover:text-bitcoin">
                {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </div>
            {modsOpen ? <OasisVisualModsPanel mod={mod} setMod={setMod} onClose={() => setModsOpen(false)} /> : null}
          <BitmapWorld3D
            tipHeight={tipHeight}
            {...(height === undefined ? {} : { initialHeight: height })}
            legend={<span data-tour="map-legend" className="flex flex-wrap items-center gap-2">{legend}</span>}
          />

          {cinematic ? null : <div className="oasis-activities grid grid-cols-1 items-start gap-3 border-y border-border p-3 sm:grid-cols-2" hidden={!toolsOpen}><DropHud /><ShardRaidHud /><ClassSkillBar /><RacePicker /><AdrenalineBot /></div>}
          </div>
          <div className="mt-2 flex flex-wrap items-stretch gap-2">
            <Link to="/command" className="hud-panel flex flex-1 items-center justify-between gap-3 px-3 py-2 font-mono text-[11px] text-bitcoin hover:text-foreground">
              <span>◆ GUARDIAN COMMAND</span><span aria-hidden="true">→</span>
            </Link>
            <button type="button" onClick={() => setToolsOpen((v) => !v)} aria-expanded={toolsOpen} className="hud-panel flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-signal hover:text-bitcoin">
              <ChevronDown className={`size-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`} /> ACTIVITIES · MARKET · RADAR
            </button>
          </div>
          {toolsOpen ? (
            <div className="mt-2 space-y-2">
              <OasisTradeTicker />
              <OasisBroadcastControl {...(height === undefined ? {} : { defaultHeight: height })} />
              <GuardianRadar {...(height === undefined ? {} : { current: height })} />
            </div>
          ) : null}
        </Suspense>
        </OasisWorldGuard>
        )}
        {entered ? <OasisControlsHint forceOpen={hintNonce} /> : null}
      </div>
    </div>
  );
}
