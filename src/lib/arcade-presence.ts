/**
 * BLOCK RUN presence — the smallest possible multiplayer layer for the arcade
 * platformer. Everyone in the same run shares one realtime channel and
 * broadcasts their position a few times a second. Nothing is persisted: this is
 * ephemeral broadcast traffic, exactly like the land-map cursors.
 */

import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { colorForVisitor, mapHandle, mapVisitorId } from "@/lib/map-identity";

export type RunPeer = {
  id: string;
  handle: string;
  color: string;
  x: number;
  y: number;
  /** rendered position, eased toward the reported one */
  rx: number;
  ry: number;
  face: 1 | -1;
  coins: number;
  finished: boolean;
  at: number;
};

export type RunSelf = {
  x: number;
  y: number;
  face: 1 | -1;
  coins: number;
  finished: boolean;
};

const SEND_MS = 90;
const STALE_MS = 8000;

/** Joins the run channel for one level and keeps a live peer list. */
export function useRunPresence(levelId: string) {
  const [peers, setPeers] = useState<RunPeer[]>([]);
  const selfRef = useRef<RunSelf>({ x: 0, y: 0, face: 1, coins: 0, finished: false });
  const peersRef = useRef(new Map<string, RunPeer>());
  const idRef = useRef("");
  const handleRef = useRef("");

  useEffect(() => {
    const selfId = mapVisitorId();
    const handle = mapHandle();
    idRef.current = selfId;
    handleRef.current = handle;
    const store = peersRef.current;
    store.clear();

    const channel = supabase
      .channel(`arcade:block-run:${levelId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "pose" }, ({ payload }) => {
        const p = payload as Partial<RunPeer> & { gone?: boolean };
        if (!p?.id || p.id === selfId) return;
        if (p.gone) {
          store.delete(p.id);
          return;
        }
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        const previous = store.get(p.id);
        store.set(p.id, {
          id: p.id,
          handle: (p.handle ?? "ANON").slice(0, 20),
          color: colorForVisitor(p.id),
          x: p.x as number,
          y: p.y as number,
          rx: previous ? previous.rx : (p.x as number),
          ry: previous ? previous.ry : (p.y as number),
          face: p.face === -1 ? -1 : 1,
          coins: Number.isFinite(p.coins) ? Math.max(0, Math.min(999, p.coins as number)) : 0,
          finished: Boolean(p.finished),
          at: Date.now(),
        });
      })
      .subscribe();

    const send = window.setInterval(() => {
      const self = selfRef.current;
      void channel.send({
        type: "broadcast",
        event: "pose",
        payload: { id: selfId, handle: handleRef.current, ...self },
      });
    }, SEND_MS);

    const sweep = window.setInterval(() => {
      const now = Date.now();
      for (const [id, peer] of store) if (now - peer.at > STALE_MS) store.delete(id);
      setPeers(Array.from(store.values()));
    }, 250);

    const leave = () => {
      void channel.send({ type: "broadcast", event: "pose", payload: { id: selfId, gone: true } });
    };
    window.addEventListener("beforeunload", leave);

    return () => {
      leave();
      window.removeEventListener("beforeunload", leave);
      window.clearInterval(send);
      window.clearInterval(sweep);
      void supabase.removeChannel(channel);
    };
  }, [levelId]);

  return { peers, peersRef, selfRef, selfId: idRef };
}
