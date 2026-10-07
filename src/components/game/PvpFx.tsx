import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type Peer = { id: string; handle: string; hp: number };
type Banner = { id: number; text: string; mine: boolean };

/**
 * PvP feedback layer — red screen-edge flash when you take damage and kill
 * banners whenever a nearby player falls. Banners also refresh the PvP
 * leaderboard so the Top 3 updates right after a takedown. Shown in the full
 * Oasis and in the X post player.
 */
export function PvpFx({
  hitAt,
  lastDamage,
  peers,
  killNote,
}: {
  hitAt: number;
  lastDamage: number;
  peers: Peer[];
  /** set by the world when your own kill is recorded */
  killNote: string | null;
}) {
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const seq = useRef(0);
  const lastHp = useRef(new Map<string, number>());

  const push = (text: string, mine: boolean) => {
    const id = ++seq.current;
    setBanners((list) => [...list.slice(-2), { id, text, mine }]);
    window.setTimeout(() => setBanners((list) => list.filter((b) => b.id !== id)), 4000);
    // Kills are written server-side a moment later; refetch the ladder after.
    window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["rank-players"] });
      void queryClient.invalidateQueries({ queryKey: ["pvp-feed"] });
    }, 1500);
  };

  useEffect(() => {
    if (!hitAt || Date.now() - hitAt > 1000) return;
    setFlash(hitAt);
    const t = window.setTimeout(() => setFlash(0), 450);
    return () => window.clearTimeout(t);
  }, [hitAt]);

  useEffect(() => {
    const seen = lastHp.current;
    for (const p of peers) {
      const before = seen.get(p.id);
      if (before !== undefined && before > 0 && p.hp <= 0) push(`☠ ${p.handle.toUpperCase()} WAS SLAIN`, false);
      seen.set(p.id, p.hp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers]);

  useEffect(() => {
    if (killNote) push(killNote, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [killNote]);

  return (
    <>
      {flash ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[60] animate-pulse"
          style={{ boxShadow: "inset 0 0 90px 24px color-mix(in oklab, var(--destructive) 70%, transparent)" }}
        >
          <span className="absolute left-1/2 top-1/3 -translate-x-1/2 font-mono text-lg font-bold text-destructive">
            -{lastDamage}
          </span>
        </div>
      ) : null}
      {banners.length ? (
        <div data-no-translate className="pointer-events-none absolute inset-x-0 top-24 z-[61] flex flex-col items-center gap-1">
          {banners.map((b) => (
            <span
              key={b.id}
              className={`hud-panel px-3 py-1 font-mono text-xs font-bold tracking-wider ${b.mine ? "text-bitcoin" : "text-destructive"}`}
            >
              {b.text}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
