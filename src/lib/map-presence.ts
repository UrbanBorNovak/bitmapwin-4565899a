import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  avatarModelInscription,
  colorForVisitor,
  mapHandle,
  mapVisitorId,
} from "@/lib/map-identity";
import { cellX, cellZ, clampPeerStep, STRIDE, type MovementState } from "@/lib/player-state";
import {
  COMBAT_TICK_MS,
  MELEE_REACH_TILES,
  createCombatResolver,
  tileOfPosition,
} from "@/lib/world-combat";
import type { ClanBadge } from "@/lib/clans";
import { useCharacter } from "@/lib/character";
import { damageActiveVehicle } from "@/lib/world-vehicle-combat";
import { guardedDamage } from "@/lib/saber-duel";

/**
 * Live presence for the land map. Every visitor broadcasts the grid cell they are
 * standing on, the on-chain avatar model they wear, and anything they say, on a
 * shared realtime channel — so the world feels populated and people can talk
 * while exploring.
 *
 * Nothing is persisted — this is ephemeral broadcast traffic only.
 */
/** A movement report a client sends about itself. Never about anyone else. */
export type PoseReport = {
  col: number;
  row: number;
  height: number;
  /** exact world position, so peers interpolate instead of hopping cell to cell */
  x?: number;
  z?: number;
  y?: number;
  yaw?: number;
  movement?: MovementState;
  /** spawn / respawn — the only legitimate teleport */
  teleport?: boolean;
};

export type MapCursor = {
  id: string;
  col: number;
  row: number;
  height: number;
  /** validated world position used for interpolation */
  x: number;
  z: number;
  y: number;
  yaw: number;
  movement: MovementState;
  color: string;
  handle: string;
  clan: ClanBadge | null;
  /** on-chain GLB inscription id worn as the avatar, if any */
  model: string | null;
  /** last thing this visitor said (shown as a speech bubble) */
  say: string | null;
  sayAt: number;
  /** current health, 0–100 */
  hp: number;
  /** when this visitor was last hit — drives the hit flash */
  hitAt: number;
  /** damage shown above the avatar for the latest validated strike */
  lastDamage: number;
  at: number;
};

export type WorldSaid = { id: string; handle: string; color: string; body: string; at: number };
export type CombatLogEntry = {
  id: string;
  attacker: string;
  target: string;
  damage: number;
  knockout: boolean;
  at: number;
};

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
/** minimum time between basic attacks */
export const ATTACK_COOLDOWN_MS = 850;
/** validated melee reach in world units */
export const ATTACK_RANGE = STRIDE * 6;
/** health regenerated per second while not being hit */
const REGEN_PER_SECOND = 3;
/** how long a knocked-out visitor stays down before respawning at full health */
const RESPAWN_MS = 15_000;

export function useMapCursors(enabled = true, clan: ClanBadge | null = null) {
  const selfId = useMemo(() => mapVisitorId(), []);
  /** the character sheet, when one has been written, names the figure you walk as */
  const character = useCharacter();
  const storedHandle = useMemo(() => mapHandle(), []);
  const handle = character?.name?.trim() ? character.name.trim() : storedHandle;
  const [model, setModel] = useState<string | null>(() => avatarModelInscription());
  /** saving a character on another tab swaps the figure here without a reload */
  useEffect(() => {
    if (!character) return;
    setModel((current) => (current === character.avatarModel ? current : character.avatarModel));
  }, [character]);
  const [cursors, setCursors] = useState<MapCursor[]>([]);
  const [said, setSaid] = useState<WorldSaid[]>([]);
  const [hp, setHp] = useState(MAX_HP);
  const [hitAt, setHitAt] = useState(0);
  const [lastDamage, setLastDamage] = useState(0);
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  /** timestamp we are scheduled to come back to life at, 0 when alive */
  const [respawnAt, setRespawnAt] = useState(0);
  /** bumps on every respawn so the world can teleport us back to the spawn point */
  const [respawnNonce, setRespawnNonce] = useState(0);
  const hpRef = useRef(MAX_HP);
  hpRef.current = hp;
  const sendRef = useRef<(pose: PoseReport | null) => void>(() => {});
  const sayRef = useRef<(body: string) => void>(() => {});
  const attackRef = useRef<(targetId: string, damage?: number, reach?: number) => void>(() => {});
  const respawnRef = useRef<() => void>(() => {});
  const hurtRef = useRef<(damage: number, source?: string) => void>(() => {});
  const healRef = useRef<(amount: number) => void>(() => {});
  const modelRef = useRef(model);
  modelRef.current = model;
  const clanRef = useRef(clan);
  clanRef.current = clan;

  useEffect(() => {
    if (!enabled) return;
    const peers = new Map<string, MapCursor>();
    const lastAttackByPlayer = new Map<string, number>();
    const combat = createCombatResolver(ATTACK_COOLDOWN_MS * 0.8);

    let frame = 0;
    const flush = () => {
      const now = Date.now();
      for (const [id, cursor] of peers) {
        if (now - cursor.at > STALE_MS) peers.delete(id);
        else if (cursor.say && now - cursor.sayAt > SAY_TTL_MS)
          peers.set(id, { ...cursor, say: null });
      }
      setCursors(Array.from(peers.values()));
    };

    // Tracks whether the realtime socket has actually joined; until it has,
    // sends go out over the slow REST fallback and must be rationed.
    let joined = false;

    const channel = supabase
      .channel(CHANNEL, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const p = payload as {
          id?: string;
          col?: number;
          row?: number;
          height?: number;
          x?: number;
          z?: number;
          y?: number;
          yaw?: number;
          movement?: MovementState;
          teleport?: boolean;
          handle?: string;
          model?: string | null;
          clan?: ClanBadge | null;
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
          const now = Date.now();
          // Remote clients are not trusted: bound the claim and cap the step to
          // the distance top speed allows since their last report.
          const position = clampPeerStep(
            previous ? { x: previous.x, z: previous.z } : null,
            {
              x: typeof p.x === "number" ? p.x : cellX(p.col),
              z: typeof p.z === "number" ? p.z : cellZ(p.row),
            },
            previous ? now - previous.at : 0,
            Boolean(p.teleport),
          );
          peers.set(p.id, {
            id: p.id,
            col: p.col,
            row: p.row,
            height: p.height,
            x: position.x,
            z: position.z,
            y:
              typeof p.y === "number" && Number.isFinite(p.y)
                ? Math.max(0, Math.min(STRIDE * 8, p.y))
                : (previous?.y ?? 0),
            yaw: typeof p.yaw === "number" && Number.isFinite(p.yaw) ? p.yaw : (previous?.yaw ?? 0),
            movement: p.movement ?? previous?.movement ?? "idle",
            color: colorForVisitor(p.id),
            handle: typeof p.handle === "string" && p.handle ? p.handle : "ANON",
            clan:
              p.clan &&
              typeof p.clan.tag === "string" &&
              typeof p.clan.crestInscriptionId === "string"
                ? { tag: p.clan.tag.slice(0, 6), crestInscriptionId: p.clan.crestInscriptionId }
                : null,
            model: typeof p.model === "string" && p.model ? p.model : null,
            say: previous?.say ?? null,
            sayAt: previous?.sayAt ?? 0,
            hp:
              typeof p.hp === "number"
                ? Math.max(0, Math.min(MAX_HP, p.hp))
                : (previous?.hp ?? MAX_HP),
            hitAt: previous?.hitAt ?? 0,
            lastDamage: previous?.lastDamage ?? 0,
            at: now,
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
        if (existing)
          peers.set(p.id, { ...existing, say: body, sayAt: Date.now(), at: Date.now() });
        setSaid((current) =>
          [
            ...current,
            { id: `${p.id}-${Date.now()}`, handle: name, color, body, at: Date.now() },
          ].slice(-30),
        );
        flush();
      })
      .on("broadcast", { event: "hit" }, ({ payload }) => {
        const p = payload as {
          id?: string;
          from?: string;
          to?: string;
          damage?: number;
          reach?: number;
          at?: number;
        };
        if (!p?.from || !p?.to) return;
        const damage = Math.max(0, Math.min(MAX_HP, Number(p.damage) || ATTACK_DAMAGE));
        const reach = Math.max(MELEE_REACH_TILES, Math.min(6, Math.round(Number(p.reach) || MELEE_REACH_TILES)));
        const now = Date.now();
        const attacker = peers.get(p.from);
        const target =
          p.to === selfId && lastCell
            ? {
                x: typeof lastCell.x === "number" ? lastCell.x : cellX(lastCell.col),
                z: typeof lastCell.z === "number" ? lastCell.z : cellZ(lastCell.row),
                handle,
              }
            : peers.get(p.to);
        if (!attacker || !target) return;
        // Queue the swing on the tile graph. Reach, blockers and swing rate are
        // all judged there; the tick below decides what it actually did.
        combat.queue({
          id: typeof p.id === "string" ? p.id : `${p.from}-${now}`,
          attacker: p.from,
          target: p.to,
          from: tileOfPosition(attacker.x, attacker.z),
          to: tileOfPosition(target.x, target.z),
          damage,
          reach,
          at: now,
        });
      })


      .subscribe((status) => {
        joined = status === "SUBSCRIBED";
      });

    let last = 0;
    let lastCell: PoseReport | null = null;
    let pending: PoseReport | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const push = (cell: PoseReport | null) => {
      // Before the socket joins, every send falls back to a slow REST call, so
      // position updates are thinned right down instead of flooding it.
      if (!joined && cell && Date.now() - last < 2_000) return;
      void channel.send({
        type: "broadcast",
        event: "cursor",
        payload: cell
          ? { id: selfId, handle, model: modelRef.current, clan: clanRef.current, hp: hpRef.current, ...cell }
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
      void channel.send({
        type: "broadcast",
        event: "say",
        payload: { id: selfId, handle, body: clean },
      });
      setSaid((current) =>
        [
          ...current,
          {
            id: `${selfId}-${Date.now()}`,
            handle,
            color: colorForVisitor(selfId),
            body: clean,
            at: Date.now(),
          },
        ].slice(-30),
      );
    };

    attackRef.current = (targetId, requestedDamage = ATTACK_DAMAGE, requestedReach = MELEE_REACH_TILES) => {
      if (!targetId || hpRef.current <= 0) return;
      const target = peers.get(targetId);
      if (!target || !lastCell) return;
      const selfX = typeof lastCell.x === "number" ? lastCell.x : cellX(lastCell.col);
      const selfZ = typeof lastCell.z === "number" ? lastCell.z : cellZ(lastCell.row);
      const now = Date.now();
      const eventId = `${selfId}-${now}`;
      const damage = Math.max(1, Math.min(MAX_HP, Math.round(requestedDamage)));
      const reach = Math.max(MELEE_REACH_TILES, Math.min(6, Math.round(requestedReach)));
      // Our own swing goes through the same tile resolver as everyone else's, so
      // reach, walls and swing rate are judged identically on every screen.
      const accepted = combat.queue({
        id: eventId,
        attacker: selfId,
        target: targetId,
        from: tileOfPosition(selfX, selfZ),
        to: tileOfPosition(target.x, target.z),
        damage,
        reach,
        at: now,
      });
      if (!accepted) return;
      lastAttackByPlayer.set(selfId, now);
      void channel.send({
        type: "broadcast",
        event: "hit",
        payload: { id: eventId, from: selfId, to: targetId, damage, reach, at: now },
      });
    };


    // Something in the world bit us — wildlife, a fall, a trap. Same health path
    // as a peer's hit, so the rest of the world sees the new value straight away.
    hurtRef.current = (damage, source) => {
      if (hpRef.current <= 0 || damage <= 0) return;
      const dealt = Math.round(damage);
      const next = Math.max(0, hpRef.current - dealt);
      const now = Date.now();
      hpRef.current = next;
      setHp(next);
      setHitAt(now);
      setLastDamage(dealt);
      if (source) {
        setCombatLog((current) =>
          [
            ...current,
            { id: `${source}:${now}:${Math.random().toString(36).slice(2, 7)}`, attacker: source, target: handle, damage: dealt, knockout: next === 0, at: now },
          ].slice(-40),
        );
      }
      if (lastCell) push(lastCell);
      if (next === 0) {
        setRespawnAt(now + RESPAWN_MS);
        if (respawnTimer) clearTimeout(respawnTimer);
        respawnTimer = setTimeout(() => respawnRef.current(), RESPAWN_MS);
      }
    };

    // A healing spell mends us. Knocked-out visitors have to wait for respawn.
    healRef.current = (amount) => {
      if (hpRef.current <= 0 || amount <= 0) return;
      const next = Math.min(MAX_HP, hpRef.current + Math.round(amount));
      if (next === hpRef.current) return;
      hpRef.current = next;
      setHp(next);
      if (lastCell) push(lastCell);
    };

    // Respawn: come back at full health and tell the world we are standing again.
    let respawnTimer: ReturnType<typeof setTimeout> | null = null;
    respawnRef.current = () => {
      if (respawnTimer) clearTimeout(respawnTimer);
      respawnTimer = null;
      hpRef.current = MAX_HP;
      setHp(MAX_HP);
      setHitAt(0);
      setLastDamage(0);
      setRespawnAt(0);
      setRespawnNonce((current) => current + 1);
      if (lastCell) push(lastCell);
    };


    // COMBAT TICK — every swing queued since the last tick is settled here, in
    // one pass, per target tile. Nothing about a fight is worked out per frame.
    const ticker = setInterval(() => {
      const now = Date.now();
      for (const hit of combat.resolve(now)) {
        const attackerName = peers.get(hit.strikes[0]!.attacker)?.handle ?? handle;
        const mine = hit.target === selfId;
        const targetPeer = peers.get(hit.target);
        const before = mine ? hpRef.current : (targetPeer?.hp ?? MAX_HP);
        const attacker = peers.get(hit.strikes[0]!.attacker);
        const vehicleHit =
          mine && attacker && lastCell
            ? damageActiveVehicle(
                hit.damage,
                { x: attacker.x, z: attacker.z },
                typeof lastCell.y === "number"
                  ? {
                      x: typeof lastCell.x === "number" ? lastCell.x : cellX(lastCell.col),
                      z: typeof lastCell.z === "number" ? lastCell.z : cellZ(lastCell.row),
                      y: lastCell.y,
                    }
                  : {
                      x: typeof lastCell.x === "number" ? lastCell.x : cellX(lastCell.col),
                      z: typeof lastCell.z === "number" ? lastCell.z : cellZ(lastCell.row),
                    },
              )
            : null;
        const rawDamage = vehicleHit?.absorbed ? vehicleHit.occupantDamage : hit.damage;
        // A raised lightsaber guard deflects most of a hit aimed at us.
        const appliedDamage = mine ? guardedDamage(rawDamage) : rawDamage;
        const after = Math.max(0, before - appliedDamage);
        setCombatLog((current) =>
          [
            ...current,
            {
              id: hit.strikes[0]!.id,
              attacker: attackerName,
              target: mine ? handle : (targetPeer?.handle ?? "ANON"),
              damage: appliedDamage,
              knockout: after === 0,
              at: now,
            },
          ].slice(-40),
        );
        if (mine) {
          hpRef.current = after;
          setHp(after);
          setHitAt(now);
          setLastDamage(appliedDamage);
          if (lastCell) push(lastCell);
          if (after === 0) {
            setRespawnAt(now + RESPAWN_MS);
            if (respawnTimer) clearTimeout(respawnTimer);
            respawnTimer = setTimeout(() => respawnRef.current(), RESPAWN_MS);
          }
        } else if (targetPeer) {
          peers.set(hit.target, {
            ...targetPeer,
            hp: after,
            hitAt: now,
            lastDamage: hit.damage,
            at: now,
          });
          flush();
        }
      }
    }, COMBAT_TICK_MS);

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
      if (respawnTimer) clearTimeout(respawnTimer);
      clearInterval(sweep);
      clearInterval(regen);
      clearInterval(ticker);
      combat.reset();
      clearInterval(heartbeat);
      if (frame) cancelAnimationFrame(frame);
      sendRef.current = () => {};
      sayRef.current = () => {};
      attackRef.current = () => {};
      respawnRef.current = () => {};
      hurtRef.current = () => {};
      healRef.current = () => {};
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
    lastDamage,
    combatLog,
    maxHp: MAX_HP,
    respawnAt,
    respawnNonce,
    respawnMs: RESPAWN_MS,
    respawn: () => respawnRef.current(),
    attack: (targetId: string, damage?: number, reach?: number) => attackRef.current(targetId, damage, reach),
    hurt: (damage: number, source?: string) => hurtRef.current(damage, source),
    heal: (amount: number) => healRef.current(amount),
    say: (body: string) => sayRef.current(body),
    publish: (pose: PoseReport | null) => sendRef.current(pose),
  };
}
