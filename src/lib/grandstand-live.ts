import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live Grandstand room: ephemeral presence (who is watching, which seat) plus
 * broadcast popcorn volleys and crowd reactions. Nothing is stored and nothing
 * here grants anything — peers' messages are cosmetic only.
 */
export type Volley = { n: number; seat: number; local: boolean };
export type ArenaReaction = "airhorn" | "cheer";
const CHANNEL = "grandstand-arena";

export function useGrandstandLive(mySeat: number | null, onReaction?: (r: ArenaReaction) => void) {
  const [viewers, setViewers] = useState(1);
  const [liveSeats, setLiveSeats] = useState<Set<number>>(new Set());
  const [volleys, setVolleys] = useState<Volley[]>([]);
  const ch = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const n = useRef(0);
  const react = useRef(onReaction); react.current = onReaction;
  const seatRef = useRef(mySeat); seatRef.current = mySeat;
  const lastSent = useRef(0);

  const push = useCallback((seat: number, local: boolean) => {
    setVolleys((v) => [...v.slice(-20), { n: ++n.current, seat, local }]);
  }, []);

  useEffect(() => {
    const key = Math.random().toString(36).slice(2);
    const c = supabase.channel(CHANNEL, { config: { broadcast: { self: false }, presence: { key } } });
    c.on("presence", { event: "sync" }, () => {
      const st = c.presenceState<{ seat: number | null }>();
      const seats = new Set<number>();
      for (const metas of Object.values(st)) for (const m of metas) if (Number.isInteger(m.seat) && m.seat! > 0) seats.add(m.seat!);
      setViewers(Math.max(1, Object.keys(st).length)); setLiveSeats(seats);
    })
      .on("broadcast", { event: "popcorn" }, ({ payload }) => {
        const s = Number(payload?.seat); if (Number.isInteger(s) && s > 0 && s < 100_000) push(s, false);
      })
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const k = payload?.kind; if (k === "airhorn" || k === "cheer") react.current?.(k);
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") void c.track({ seat: seatRef.current }); });
    ch.current = c;
    return () => { ch.current = null; void supabase.removeChannel(c); };
  }, [push]);

  useEffect(() => { void ch.current?.track({ seat: mySeat }); }, [mySeat]);

  const throwPopcorn = useCallback(() => {
    if (!mySeat) return; push(mySeat, true);
    void ch.current?.send({ type: "broadcast", event: "popcorn", payload: { seat: mySeat } });
  }, [mySeat, push]);
  const sendReaction = useCallback((kind: ArenaReaction) => {
    const now = Date.now(); if (now - lastSent.current < 1500) return; lastSent.current = now;
    void ch.current?.send({ type: "broadcast", event: "react", payload: { kind } });
  }, []);
  return { viewers, liveSeats, volleys, throwPopcorn, sendReaction };
}
