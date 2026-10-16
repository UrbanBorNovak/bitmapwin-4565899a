/**
 * MINIMAP — the pocket map you carry while you explore.
 *
 * A single 2D canvas painted on an animation frame from the predicted pose, so
 * it never re-renders React and never allocates per frame. It shows the land
 * grid around you, the terrain the world has streamed in (water, rock, built
 * plots), the BITMAPs you own, everybody else out there, your party mates by
 * name, and your own heading as an arrow at the centre. Press M for the full map.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL, WORLD_GRID, WORLD_UNITS } from "@/lib/player-state";
import { useQuery } from "@tanstack/react-query";
import { builtWorldQuery } from "@/lib/built-bitmaps";
import { VOXEL, blockColor } from "@/lib/voxel-world";
import type { MapCursor } from "@/lib/map-presence";
import { CHUNK_TILES, TILE, loadedChunks } from "@/lib/world-grid";
import { MAX_RELIEF, groundY, requestTerrainAround, terrainVersion } from "@/lib/world-terrain";
import { WorldScanSvg } from "@/components/game/WorldScanSvg";

/** how many districts fit across the minimap, near to far */
const ZOOMS = [16, 48, 160] as const;

type Props = {
  pose: React.RefObject<PlayerState>;
  cursors: MapCursor[];
  ownedHeights: number[];
  /** visitor ids currently grouped with you */
  partyIds?: string[];
  /** jump the big camera to a district when the expanded map is clicked */
  onVisit?: (height: number) => void;
  /** Hide the pocket map while keeping the full map available on demand. */
  showCompact?: boolean;
  /** Optional controlled state used by the world-first HUD. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Render the scan inside a panel (base menu) instead of floating on the HUD. */
  inline?: boolean;
};

const colOf = (x: number) => Math.floor((x + WORLD_UNITS / 2) / WORLD_CELL);
const rowOf = (z: number) => Math.floor(z / WORLD_CELL);

function readColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function Minimap({
  pose,
  cursors,
  ownedHeights,
  partyIds,
  onVisit,
  showCompact = true,
  expanded: controlledExpanded,
  onExpandedChange,
  inline = false,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Offscreen relief raster: the real land shape, repainted only when the view
  // window moves or new BITMAP rows arrive — never per frame.
  const terrain = useRef<HTMLCanvasElement | null>(null);
  const terrainKey = useRef("");
  const terrainAt = useRef(0);
  const [zoom, setZoom] = useState(1);
  const [internalExpanded, setInternalExpanded] = useState(false);
  // An inline scan never takes over the screen; it always shows the local view.
  const expanded = inline ? false : (controlledExpanded ?? internalExpanded);
  const setExpanded = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(expanded) : next;
      if (controlledExpanded === undefined) setInternalExpanded(value);
      onExpandedChange?.(value);
    },
    [controlledExpanded, expanded, onExpandedChange],
  );
  const [readout, setReadout] = useState({ col: 0, row: 0, height: 0 });

  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;

  const partySet = useMemo(() => new Set(partyIds ?? []), [partyIds]);
  const partyRef = useRef(partySet);
  partyRef.current = partySet;

  const owned = useMemo(
    () =>
      ownedHeights.map((height) => ({
        col: height % WORLD_GRID,
        row: Math.floor(height / WORLD_GRID),
      })),
    [ownedHeights],
  );
  const ownedRef = useRef(owned);
  ownedRef.current = owned;
  const builtWorld = useQuery(builtWorldQuery());
  const builtRef = useRef(builtWorld.data);
  builtRef.current = builtWorld.data;

  const partyPeers = useMemo(
    () => cursors.filter((peer) => partySet.has(peer.id)),
    [cursors, partySet],
  );

  // M toggles the full-size map.
  useEffect(() => {
    if (inline || controlledExpanded !== undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "m") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      setExpanded((current) => !current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controlledExpanded, setExpanded]);

  useEffect(() => {
    let frame = 0;
    const theme = {
      ink: readColor("--foreground", "#e6e6e6"),
      bitcoin: readColor("--bitcoin", "#f7931a"),
      signal: readColor("--signal", "#55dbea"),
      muted: readColor("--muted-foreground", "#8a8a8a"),
      bg: readColor("--background", "#0a0a0a"),
    };
    let lastLabel = -1;

    const paint = () => {
      frame = requestAnimationFrame(paint);
      const el = canvas.current;
      const player = pose.current;
      if (!el || !player) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = el.clientWidth;
      if (el.width !== Math.round(size * dpr)) {
        el.width = Math.round(size * dpr);
        el.height = Math.round(size * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const districts = expanded ? WORLD_GRID : ZOOMS[zoom]!;
      const span = districts * WORLD_CELL;
      const centerX = expanded ? 0 : player.x;
      const centerZ = expanded ? WORLD_UNITS / 2 : player.z;
      const scale = size / span;
      const toPx = (x: number) => (x - centerX) * scale + size / 2;
      const toPy = (z: number) => (z - centerZ) * scale + size / 2;

      // REAL LAND — the relief is sampled from the same terrain field the world
      // is built from, so the scan shows the actual hills, basins and water of
      // every BITMAP in view, anywhere in the world.
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, size, size);
      const left = centerX - span / 2;
      const top = centerZ - span / 2;
      const key = `${Math.round(left * 40)}:${Math.round(top * 40)}:${Math.round(span * 40)}:${terrainVersion()}`;
      const now0 = performance.now();
      if (key !== terrainKey.current && now0 - terrainAt.current > 260) {
        terrainAt.current = now0;
        terrainKey.current = key;
        const R = 168;
        const raster = terrain.current ?? document.createElement("canvas");
        raster.width = R;
        raster.height = R;
        terrain.current = raster;
        const rctx = raster.getContext("2d");
        if (rctx) {
          const image = rctx.createImageData(R, R);
          const data = image.data;
          for (let py = 0; py < R; py++) {
            const wz = top + ((py + 0.5) / R) * span;
            for (let px = 0; px < R; px++) {
              const wx = left + ((px + 0.5) / R) * span;
              const y = groundY(wx, wz);
              const level = Math.max(-1, Math.min(1, y / MAX_RELIEF));
              let r: number;
              let g: number;
              let b: number;
              if (level < 0) {
                // water: deeper reads colder
                const deep = Math.min(1, -level * 1.5);
                r = 24 + (1 - deep) * 26;
                g = 96 + (1 - deep) * 44;
                b = 128 + (1 - deep) * 46;
              } else {
                const t = Math.min(1, level * 1.25);
                r = 96 + t * 130;
                g = 62 + t * 112;
                b = 34 + t * 92;
              }
              const o = (py * R + px) * 4;
              data[o] = r;
              data[o + 1] = g;
              data[o + 2] = b;
              data[o + 3] = 235;
            }
          }
          rctx.putImageData(image, 0, 0);
        }
        void requestTerrainAround(centerX, centerZ);
      }
      const raster = terrain.current;
      if (raster && raster.width > 0) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(raster, 0, 0, raster.width, raster.height, 0, 0, size, size);
      }
      ctx.globalAlpha = 1;

      // terrain the world has streamed in: water, rock, built plots
      const tilePx = Math.max(1, WORLD_CELL * scale);
      if (tilePx > 1.2) {
        for (const chunk of loadedChunks().values()) {
          const cx0 = toPx(chunk.col0 * WORLD_CELL - WORLD_UNITS / 2);
          const cz0 = toPy(chunk.row0 * WORLD_CELL);
          const chunkPx = CHUNK_TILES * tilePx;
          if (cx0 + chunkPx < 0 || cz0 + chunkPx < 0 || cx0 > size || cz0 > size) continue;
          for (let i = 0; i < chunk.flags.length; i++) {
            const flags = chunk.flags[i] ?? 0;
            if ((flags & (TILE.WATER | TILE.BLOCKED | TILE.DEPLOYED | TILE.OCCUPIED)) === 0)
              continue;
            const x = cx0 + (i % CHUNK_TILES) * tilePx;
            const z = cz0 + Math.floor(i / CHUNK_TILES) * tilePx;
            if (x < -tilePx || z < -tilePx || x > size || z > size) continue;
            if ((flags & TILE.WATER) !== 0) {
              ctx.fillStyle = "hsl(190 70% 45%)";
              ctx.globalAlpha = 0.7;
            } else if ((flags & TILE.DEPLOYED) !== 0) {
              ctx.fillStyle = theme.bitcoin;
              ctx.globalAlpha = 0.8;
            } else {
              ctx.fillStyle = theme.muted;
              ctx.globalAlpha = 0.5;
            }
            ctx.fillRect(x, z, Math.max(1, tilePx), Math.max(1, tilePx));
          }
        }
        ctx.globalAlpha = 1;
      }

      // district grid — only when the lines would be readable
      const step = WORLD_CELL * scale;
      if (step > 6) {
        ctx.strokeStyle = theme.muted;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const firstCol = Math.floor((centerX - span / 2 + WORLD_UNITS / 2) / WORLD_CELL);
        const firstRow = Math.floor((centerZ - span / 2) / WORLD_CELL);
        for (let i = 0; i <= districts + 1; i++) {
          const gx = toPx((firstCol + i) * WORLD_CELL - WORLD_UNITS / 2);
          const gz = toPy((firstRow + i) * WORLD_CELL);
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, size);
          ctx.moveTo(0, gz);
          ctx.lineTo(size, gz);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // world edge
      ctx.strokeStyle = theme.muted;
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(
        toPx(-WORLD_UNITS / 2),
        toPy(0),
        WORLD_UNITS * scale,
        WORLD_UNITS * scale,
      );
      ctx.globalAlpha = 1;

      // built BITMAPs (cyan frames) and every placed voxel in its block colour
      const world = builtRef.current;
      if (world) {
        ctx.strokeStyle = theme.signal;
        ctx.lineWidth = 1.5;
        const box = Math.max(4, Math.min(14, step));
        for (const b of world.built) {
          const x = toPx((b.height % WORLD_GRID) * WORLD_CELL - WORLD_UNITS / 2);
          const z = toPy(Math.floor(b.height / WORLD_GRID) * WORLD_CELL);
          if (x < -box || z < -box || x > size + box || z > size + box) continue;
          ctx.globalAlpha = 0.9;
          ctx.strokeRect(x, z, box, box);
        }
        const vpx = Math.max(1, VOXEL * scale);
        for (const v of world.voxels) {
          const x = toPx(v.x * VOXEL);
          const z = toPy(v.z * VOXEL);
          if (x < 0 || z < 0 || x > size || z > size) continue;
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = blockColor(v.kind).top;
          ctx.fillRect(x, z, vpx, vpx);
        }
        ctx.globalAlpha = 1;
      }

      // your own BITMAPs
      ctx.fillStyle = theme.bitcoin;
      const dot = Math.max(2, Math.min(10, step));
      for (const cell of ownedRef.current) {
        const x = toPx(cell.col * WORLD_CELL - WORLD_UNITS / 2);
        const z = toPy(cell.row * WORLD_CELL);
        if (x < -dot || z < -dot || x > size + dot || z > size + dot) continue;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, z, dot, dot);
      }
      ctx.globalAlpha = 1;

      // everybody else out there — party mates read louder, with a name tag
      for (const peer of cursorsRef.current) {
        const x = toPx(peer.x);
        const z = toPy(peer.z);
        if (x < 0 || z < 0 || x > size || z > size) continue;
        const inParty = partyRef.current.has(peer.id);
          ctx.fillStyle = peer.color || theme.signal;
        ctx.beginPath();
        ctx.arc(x, z, inParty ? 4.5 : expanded ? 2.5 : 3, 0, Math.PI * 2);
        ctx.fill();
        if (inParty) {
          ctx.strokeStyle = theme.bitcoin;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, z, 6.5, 0, Math.PI * 2);
          ctx.stroke();
          if (!expanded) {
            ctx.fillStyle = theme.ink;
            ctx.font = "8px ui-monospace, monospace";
            ctx.fillText(peer.handle.slice(0, 8).toUpperCase(), x + 8, z + 3);
          }
        }
      }

      // you: an arrow pointing where you face
      const sx = toPx(player.x);
      const sz = toPy(player.z);
      ctx.save();
      ctx.translate(sx, sz);
      // world forward is (sin yaw, cos yaw) in x/z; the arrow art points up (0,-1)
      ctx.rotate(Math.PI - player.yaw);
      ctx.fillStyle = theme.bitcoin;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 3.5);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = theme.bg;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // compass ticks
      ctx.fillStyle = theme.muted;
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("N", size / 2 - 3, 11);
      ctx.fillText("S", size / 2 - 3, size - 3);
      ctx.fillText("W", 3, size / 2 + 3);
      ctx.fillText("E", size - 10, size / 2 + 3);

      // 4Hz text readout, cheap
      const now = performance.now();
      if (now - lastLabel > 250) {
        lastLabel = now;
        const col = colOf(player.x);
        const row = rowOf(player.z);
        setReadout((current) =>
          current.col === col && current.row === row && current.height === player.height
            ? current
            : { col, row, height: player.height },
        );
      }
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [expanded, pose, zoom]);

  const body = (
    <>
      <canvas
        ref={canvas}
        className="block aspect-square w-full cursor-crosshair"
        onClick={(event) => {
          if (!expanded || !onVisit) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const fx = (event.clientX - rect.left) / rect.width;
          const fz = (event.clientY - rect.top) / rect.height;
          const col = Math.floor(fx * WORLD_GRID);
          const row = Math.floor(fz * WORLD_GRID);
          if (col < 0 || row < 0 || col >= WORLD_GRID || row >= WORLD_GRID) return;
          onVisit(row * WORLD_GRID + col);
        }}
      />
      <div className="flex items-center justify-between border-t border-border px-1.5 py-1 text-[9px] text-muted-foreground">
        <span className="tabular-nums text-foreground">
          {readout.height.toLocaleString("en-US")}.BITMAP
        </span>
        <span className="tabular-nums">
          {readout.col} · {readout.row}
        </span>
      </div>
    </>
  );

  const partyRoster = partyPeers.length ? (
    <ul className="border-t border-border px-1.5 py-1 text-[9px] leading-tight">
      <li className="label text-[8px] text-bitcoin">PARTY</li>
      {partyPeers.slice(0, 3).map((peer) => (
        <li key={peer.id} className="flex items-center justify-between gap-1 text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <span
              className="inline-block size-1.5 shrink-0 rounded-full"
              style={{ background: peer.color }}
            />
            <span className="truncate text-foreground">{peer.handle.toUpperCase()}</span>
          </span>
          <span className="tabular-nums">{peer.height.toLocaleString("en-US")}</span>
        </li>
      ))}
    </ul>
  ) : null;

  // Base menu: the same live scan, sitting inside a panel instead of floating.
  if (inline) {
    return (
      <div data-no-translate aria-label="Base map" className="border border-border font-mono">
        <header className="flex items-center justify-between gap-1 border-b border-signal/20 px-1.5 py-1 text-[9px]">
          <span className="hud-telemetry-title">BASE SCAN</span>
          <button
            type="button"
            className="border border-border px-1 text-muted-foreground hover:border-signal hover:text-signal"
            title="Zoom the scan"
            onClick={() => setZoom((current) => (current + 1) % ZOOMS.length)}
          >
            {ZOOMS[zoom]}
          </button>
        </header>
        {body}
        {partyRoster}
      </div>
    );
  }

  return (
    <>
      {showCompact ? <div
        data-no-translate
        aria-label="Minimap"
        className="hud-panel pointer-events-auto absolute bottom-3 right-3 z-40 w-[188px] font-mono"
      >
        <header className="flex items-center justify-between gap-1 border-b border-signal/20 px-1.5 py-1 text-[9px]">
          <span className="hud-telemetry-title">LOCAL SCAN</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              className="border border-border px-1 text-muted-foreground hover:border-signal hover:text-signal"
              title="Zoom the minimap"
              onClick={() => setZoom((current) => (current + 1) % ZOOMS.length)}
            >
              {ZOOMS[zoom]}
            </button>
            <button
              type="button"
              className="border border-border px-1 text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
              title="Open the full map (M)"
              onClick={() => setExpanded(true)}
            >
              M
            </button>
          </span>
        </header>
        {expanded ? (
          <div className="px-1.5 py-2 text-[9px] text-muted-foreground">FULL MAP OPEN · M</div>
        ) : (
          <>
            {body}
            {partyRoster}
          </>
        )}
      </div> : null}

      {expanded ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          role="dialog"
          aria-label="World map"
        >
          <div
            data-no-translate
            className="hud-panel w-[min(56vh,90%)] max-w-[560px] font-mono"
          >
            <header className="flex items-center justify-between border-b border-border px-2 py-1 text-[10px]">
              <span className="hud-telemetry-title">OASIS ATLAS · 1,000 × 1,000 BITMAPS</span>
              <span className="flex items-center gap-1">
                <Link
                  to="/map/$block"
                  params={{ block: String(readout.height) }}
                  className="border border-signal/50 px-1.5 py-0.5 text-signal hover:border-signal hover:bg-signal/10"
                >
                  OPEN ATLAS
                </Link>
                <button
                  type="button"
                  className="border border-border px-1.5 py-0.5 text-muted-foreground hover:border-foreground hover:text-foreground"
                  onClick={() => setExpanded(false)}
                >
                  CLOSE · M
                </button>
              </span>
            </header>
            <WorldScanSvg
              height={readout.height}
              ownedHeights={ownedHeights}
              peers={cursors.map((peer) => ({
                id: peer.id,
                height: peer.height,
                color: peer.color,
                handle: peer.handle,
              }))}
              onVisit={onVisit}
            />
            {partyRoster}
            <p className="border-t border-border px-2 py-1 text-[9px] text-muted-foreground">
              CLICK ANY BITMAP TO TRAVEL THERE · ORANGE DIAMONDS ARE YOURS · CYAN RING IS THE LIVING
              FRONTIER · OPEN ATLAS FOR ZOOM, HISTORY, CLAIMS AND BUILDS
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
