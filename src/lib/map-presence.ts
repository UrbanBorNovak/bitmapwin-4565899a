import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avatarModelInscription, colorForVisitor, mapHandle, mapVisitorId } from "@/lib/map-identity";

/**
 * Live presence for the land map. Every visitor broadcasts the grid cell they are
 * standing on, the on-chain avatar model they wear, and anything they say, on a
 * shared realtime channel — so the world feels populated and people can talk
 * while exploring.
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
  /** on-chain GLB inscription id worn as the avatar, if any */
  model: string | null;
  /** last thing this visitor said (shown as a speech bubble) */
  say: string | null;
  sayAt: number;
  at: number;
};

export type WorldSaid = { id: string; handle: string; color: string; body: string; at: number };

const CHANNEL = "map-cursors";
/** cursors older than this are considered gone */
const STALE_MS = 8_000;
/** at most this many messages per second per visitor */
const SEND_INTERVAL_MS = 90;
/** speech bubbles fade after this long */
export const SAY_TTL_MS = 9_000;
export const SAY_MAX_LENGTH = 140;

export function useMapCursors(enabled = true) {
  const selfId = useMemo(() => mapVisitorId(), []);
  const handle = useMemo(() => mapHandle(), []);
  const [model, setModel] = useState<string | null>(() => avatarModelInscription());
  const [cursors, setCursors] = useState<MapCursor[]>([]);
  const [said, setSaid] = useState<WorldSaid[]>([]);
  const sendRef = useRef<(cell: { col: number; row: number; height: number } | null) => void>(() => {});
  const sayRef = useRef<(body: string) => void>(() => {});
  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    if (!enabled) return;
    const peers = new Map<string, MapCursor>();
    let frame = 0;
    const flush = () => {
      const now = Date.now();
      for (const [id, cursor] of peers) {
        if (now - cursor.at > STALE_MS) peers.delete(id);
        else if (cursor.say && now - cursor.sayAt > SAY_TTL_MS) peers.set(id, { ...cursor, say: null });
      }
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
          model?: string | null;
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
          const previous = peers.get(p.id);
          peers.set(p.id, {
            id: p.id,
            col: p.col,
            row: p.row,
            height: p.height,
            color: colorForVisitor(p.id),
            handle: typeof p.handle === "string" && p.handle ? p.handle : "ANON",
            model: typeof p.model === "string" && p.model ? p.model : null,
            say: previous?.say ?? null,
            sayAt: previous?.sayAt ?? 0,
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
      .on("broadcast", { event: "say" }, ({ payload }) => {
        const p = payload as { id?: string; handle?: string; body?: string };
        if (!p?.id || !p.body) return;
        const body = String(p.body).slice(0, SAY_MAX_LENGTH);
        const color = colorForVisitor(p.id);
        const name = typeof p.handle === "string" && p.handle ? p.handle : "ANON";
        const existing = peers.get(p.id);
        if (existing) peers.set(p.id, { ...existing, say: body, sayAt: Date.now(), at: Date.now() });
        setSaid((current) =>
          [...current, { id: `${p.id}-${Date.now()}`, handle: name, color, body, at: Date.now() }].slice(-30),
        );
        flush();
      })
      .subscribe();

    let last = 0;
    let lastCell: { col: number; row: number; height: number } | null = null;
    let pending: { col: number; row: number; height: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const push = (cell: { col: number; row: number; height: number } | null) => {
      void channel.send({
        type: "broadcast",
        event: "cursor",
        payload: cell
          ? { id: selfId, handle, model: modelRef.current, ...cell }
          : { id: selfId, gone: true },
      });
      last = Date.now();
    };
    // Avatars stay spawned in the world: re-broadcast the last position on a
    // heartbeat so peers never see us expire while the tab is open.
    const heartbeat = setInterval(() => {
      if (lastCell) push(lastCell);
    }, STALE_MS / 2);
    sendRef.current = (cell) => {
      if (!cell) {
        // Pointer left the map — keep the avatar standing where it was.
        if (timer) clearTimeout(timer);
        timer = null;
        pending = null;
        return;
      }
      lastCell = cell;
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
    sayRef.current = (body) => {
      const clean = body.trim().slice(0, SAY_MAX_LENGTH);
      if (!clean) return;
      void channel.send({ type: "broadcast", event: "say", payload: { id: selfId, handle, body: clean } });
      setSaid((current) =>
        [
          ...current,
          { id: `${selfId}-${Date.now()}`, handle, color: colorForVisitor(selfId), body: clean, at: Date.now() },
        ].slice(-30),
      );
    };

    const sweep = setInterval(flush, 2_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(sweep);
      clearInterval(heartbeat);
      if (frame) cancelAnimationFrame(frame);
      sendRef.current = () => {};
      sayRef.current = () => {};
      push(null); // despawn: tell peers this avatar left the world
      void supabase.removeChannel(channel);
    };
  }, [enabled, selfId, handle]);

  return {
    selfId,
    handle,
    color: colorForVisitor(selfId),
    model,
    setModel,
    cursors,
    said,
    say: (body: string) => sayRef.current(body),
    publish: (cell: { col: number; row: number; height: number } | null) => sendRef.current(cell),
  };
}
