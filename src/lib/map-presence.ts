import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { colorForVisitor, mapHandle, mapVisitorId } from "@/lib/map-identity";

/**
 * Live cursor presence for the land map. Every visitor broadcasts the grid cell
 * their cursor is hovering over on a shared realtime channel, so the map feels
 * populated: you can see where other people are searching for land.
 *
 * Nothing is persisted — this is ephemeral broadcast traffic only.
 */
export type MapCursor = {
  id: string;
  col: number;
  row: number;
  height: number;
  color: string;
  handle: string;
  at: number;
};

const CHANNEL = "map-cursors";
/** cursors older than this are considered gone */
const STALE_MS = 8_000;
/** at most this many messages per second per visitor */
const SEND_INTERVAL_MS = 90;

export function useMapCursors(enabled = true) {
  const selfId = useMemo(() => mapVisitorId(), []);
  const handle = useMemo(() => mapHandle(), []);
  const [cursors, setCursors] = useState<MapCursor[]>([]);
  const sendRef = useRef<(cell: { col: number; row: number; height: number } | null) => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    const peers = new Map<string, MapCursor>();
    let frame = 0;
    const flush = () => {
      const now = Date.now();
      for (const [id, cursor] of peers) if (now - cursor.at > STALE_MS) peers.delete(id);
      setCursors(Array.from(peers.values()));
    };

    const channel = supabase
      .channel(CHANNEL, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const p = payload as {
          id?: string;
          col?: number;
          row?: number;
          height?: number;
          handle?: string;
          gone?: boolean;
        };
        if (!p?.id || p.id === selfId) return;
        if (p.gone) {
          peers.delete(p.id);
        } else if (
          typeof p.col === "number" &&
          typeof p.row === "number" &&
          typeof p.height === "number"
        ) {
          peers.set(p.id, {
            id: p.id,
            col: p.col,
            row: p.row,
            height: p.height,
            color: colorForVisitor(p.id),
            handle: typeof p.handle === "string" && p.handle ? p.handle : "ANON",
            at: Date.now(),
          });
        }
        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            flush();
          });
        }
      })
      .subscribe();

    let last = 0;
    let pending: { col: number; row: number; height: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const push = (cell: { col: number; row: number; height: number } | null) => {
      void channel.send({
        type: "broadcast",
        event: "cursor",
        payload: cell ? { id: selfId, handle, ...cell } : { id: selfId, gone: true },
      });
      last = Date.now();
    };
    sendRef.current = (cell) => {
      if (!cell) {
        if (timer) clearTimeout(timer);
        timer = null;
        pending = null;
        push(null);
        return;
      }
      const wait = SEND_INTERVAL_MS - (Date.now() - last);
      if (wait <= 0) {
        push(cell);
        return;
      }
      pending = cell;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          if (pending) push(pending);
          pending = null;
        }, wait);
      }
    };

    const sweep = setInterval(flush, 2_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(sweep);
      if (frame) cancelAnimationFrame(frame);
      sendRef.current = () => {};
      void supabase.removeChannel(channel);
    };
  }, [enabled, selfId, handle]);

  return { selfId, handle, cursors, publish: (cell: { col: number; row: number; height: number } | null) => sendRef.current(cell) };
}
