/**
 * BASE MENU — your home shelf in the world HUD.
 *
 * One panel that answers "where am I and who is around": the live scan map of
 * the land you are standing on, plus everybody else out there sorted by how
 * close they are, with a jump-the-camera button and a party invite for each.
 */

import { useEffect, useMemo, useState } from "react";
import { Minimap } from "@/components/game/Minimap";
import type { PlayerState } from "@/lib/player-state";
import { STRIDE } from "@/lib/player-state";
import type { MapCursor } from "@/lib/map-presence";

type Props = {
  pose: React.RefObject<PlayerState>;
  cursors: MapCursor[];
  ownedHeights: number[];
  partyIds?: string[];
  /** point the camera at a district */
  onVisit?: (height: number) => void;
  /** ask somebody to join your party */
  onInvite?: (id: string) => void;
};

export function BaseMenu({ pose, cursors, ownedHeights, partyIds, onVisit, onInvite }: Props) {
  // Distances only need to be roughly live — 2Hz keeps the list calm to read.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((current) => current + 1), 500);
    return () => window.clearInterval(timer);
  }, []);

  const partySet = useMemo(() => new Set(partyIds ?? []), [partyIds]);

  const nearby = useMemo(() => {
    const player = pose.current;
    const px = player?.x ?? 0;
    const pz = player?.z ?? 0;
    return cursors
      .map((peer) => ({
        peer,
        strides: Math.round(Math.hypot(peer.x - px, peer.z - pz) / STRIDE),
      }))
      .sort((a, b) => a.strides - b.strides)
      .slice(0, 10);
    // tick refreshes the distances as you move
  }, [cursors, pose, tick]);

  return (
    <div className="flex flex-col gap-2" data-no-translate>
      <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Base</span>

      <Minimap
        inline
        pose={pose}
        cursors={cursors}
        ownedHeights={ownedHeights}
        partyIds={partyIds ?? []}
        {...(onVisit ? { onVisit } : {})}
      />

      <div className="border border-border font-mono text-[10px]">
        <header className="flex items-center justify-between border-b border-signal/20 px-1.5 py-1 text-[9px]">
          <span className="hud-telemetry-title">NEARBY</span>
          <span className="tabular-nums text-signal">{cursors.length} ONLINE</span>
        </header>
        {nearby.length ? (
          <ul className="max-h-40 overflow-y-auto">
            {nearby.map(({ peer, strides }) => (
              <li
                key={peer.id}
                className="flex items-center gap-1 border-b border-border/60 px-1.5 py-1 last:border-0"
              >
                <span
                  className="inline-block size-1.5 shrink-0 rounded-full"
                  style={{ background: peer.color }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {partySet.has(peer.id) ? "◆ " : ""}
                  {peer.handle.toUpperCase()}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{strides} STEPS</span>
                <button
                  type="button"
                  className="grid size-6 shrink-0 place-items-center border border-border text-muted-foreground hover:border-signal hover:text-signal [&_svg]:size-3.5"
                  title="Point the camera at them"
                  aria-label="Point the camera at them"
                  onClick={() => onVisit?.(peer.height)}
                >
                  <Crosshair />
                </button>
                {onInvite && !partySet.has(peer.id) ? (
                  <button
                    type="button"
                    className="grid size-6 shrink-0 place-items-center border border-border text-bitcoin hover:border-bitcoin [&_svg]:size-3.5"
                    title="Invite them to your party"
                    aria-label="Invite them to your party"
                    onClick={() => onInvite(peer.id)}
                  >
                    <UserPlus />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1.5 py-2 text-[9px] text-muted-foreground">
            NOBODY ELSE IN THE OASIS RIGHT NOW
          </p>
        )}
      </div>
    </div>
  );
}
