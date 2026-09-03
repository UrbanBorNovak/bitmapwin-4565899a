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
  /** current health, 0–100 */
  hp: number;
  /** when this visitor was last hit — drives the hit flash */
  hitAt: number;
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
/** full health for every visitor */
export const MAX_HP = 100;
/** damage one basic attack lands */
export const ATTACK_DAMAGE = 12;
/** health regenerated per second while not being hit */
const REGEN_PER_SECOND = 3;
/** how long a knocked-out visitor stays down before respawning at full health */
const RESPAWN_MS = 4_000;

export function useMapCursors(enabled = true) {
  const selfId = useMemo(() => mapVisitorId(), []);
  const handle = useMemo(() => mapHandle(), []);
  const [model, setModel] = useState<string | null>(() => avatarModelInscription());
  const [cursors, setCursors] = useState<MapCursor[]>([]);
  const [said, setSaid] = useState<WorldSaid[]>([]);
  const [hp, setHp] = useState(MAX_HP);
  const [hitAt, setHitAt] = useState(0);
  const hpRef = useRef(MAX_HP);
  hpRef.current = hp;
  const sendRef = useRef<(cell: { col: number; row: number; height: number } | null) => void>(() => {});
  const sayRef = useRef<(body: string) => void>(() => {});
  const attackRef = useRef<(targetId: string) => void>(() => {});
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
          hp?: number;
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
            hp: typeof p.hp === "number" ? Math.max(0, Math.min(MAX_HP, p.hp)) : (previous?.hp ?? MAX_HP),
            hitAt: previous?.hitAt ?? 0,
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
      .on("broadcast", { event: "hit" }, ({ payload }) => {
        const p = payload as { from?: string; to?: string; damage?: number };
        if (!p?.from || !p?.to) return;
        const damage = Math.max(0, Math.min(MAX_HP, Number(p.damage) || ATTACK_DAMAGE));
        if (p.to === selfId) {
          // We took the hit: drop our own health and tell everyone the new value.
          const next = Math.max(0, hpRef.current - damage);
          hpRef.current = next;
          setHp(next);
          setHitAt(Date.now());
          if (lastCell) push(lastCell);
          if (next === 0) {
            // Killed: start the respawn countdown, then bring us back at full health.
            setRespawnAt(Date.now() + RESPAWN_MS);
            if (respawnTimer) clearTimeout(respawnTimer);
            respawnTimer = setTimeout(() => respawnRef.current(), RESPAWN_MS);
          }
        } else {
          const target = peers.get(p.to);
          if (target) {
            peers.set(p.to, { ...target, hp: Math.max(0, target.hp - damage), hitAt: Date.now(), at: Date.now() });
            flush();
          }
        }
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
          ? { id: selfId, handle, model: modelRef.current, hp: hpRef.current, ...cell }
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

    attackRef.current = (targetId) => {
      if (!targetId || hpRef.current <= 0) return;
      void channel.send({
        type: "broadcast",
        event: "hit",
        payload: { from: selfId, to: targetId, damage: ATTACK_DAMAGE },
      });
      const target = peers.get(targetId);
      if (target) {
        peers.set(targetId, { ...target, hp: Math.max(0, target.hp - ATTACK_DAMAGE), hitAt: Date.now(), at: Date.now() });
        flush();
      }
    };

    // Health trickles back so a fight does not permanently knock anyone out.
    const regen = setInterval(() => {
      if (hpRef.current <= 0 || hpRef.current >= MAX_HP) return;
      const next = Math.min(MAX_HP, hpRef.current + REGEN_PER_SECOND);
      hpRef.current = next;
      setHp(next);
    }, 1_000);

    const sweep = setInterval(flush, 2_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(sweep);
      clearInterval(regen);
      clearInterval(heartbeat);
      if (frame) cancelAnimationFrame(frame);
      sendRef.current = () => {};
      sayRef.current = () => {};
      attackRef.current = () => {};
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
    hp,
    hitAt,
    maxHp: MAX_HP,
    attack: (targetId: string) => attackRef.current(targetId),
    say: (body: string) => sayRef.current(body),
    publish: (cell: { col: number; row: number; height: number } | null) => sendRef.current(cell),
  };
}
