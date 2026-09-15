/**
 * OASIS SETTLERS — the living crowd in the sand.
 *
 * Every settler runs on plain rules in the browser: wander the sand, work a
 * seam, hawk goods, or come at you. No model calls, no server tick, so the
 * population is free to run at any size the player picks.
 *
 * Settlers are registered as strikeable bodies, so weapons, traps and the hit
 * log treat them exactly like wildlife and Punks.
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { playSfx } from "@/lib/world-audio";
import {
  liveVeins,
  mineVoxel,
  registerBeastGroup,
  type BeastEntity,
  type OreVein,
} from "@/lib/world-entities";
import {
  BOT_ROLES,
  botCount,
  botHash,
  botRoster,
  subscribeBotCount,
  type BotPlan,
  type BotRole,
} from "@/lib/world-bots";

type Bot = BeastEntity &
  BotPlan & {
    heading: number;
    lastBite: number;
    lastWork: number;
    /** current line above the head, and when it should clear */
    say: string | null;
    sayUntil: number;
    nextSay: number;
    vein: OreVein | null;
  };

/** how far from the player settlers stay loaded before walking back in */
const REACH = 46;

function makeBot(plan: BotPlan, unit: number): Bot {
  const hp = Math.round(plan.role === "raider" ? 90 : 60);
  return {
    ...plan,
    label: `${plan.name} · ${BOT_ROLES[plan.role].label}`,
    hostile: plan.role === "raider",
    hp,
    maxHp: hp,
    x: 0,
    z: 0,
    bodyY: unit * plan.size * 0.6,
    bodyRadius: unit * plan.size * 0.3,
    xp: plan.role === "raider" ? 120 : 70,
    hitAt: 0,
    deadUntil: 0,
    heading: botHash(plan.id, 5) * Math.PI * 2,
    lastBite: 0,
    lastWork: 0,
    say: null,
    sayUntil: 0,
    nextSay: 2_000 + botHash(plan.id, 7) * 16_000,
    vein: null,
  };
}

const ROLE_TINT: Record<BotRole, string> = {
  wanderer: "#cfcfcf",
  miner: "#c9a227",
  raider: "#b23b3b",
  trader: "#5aa9c9",
};

/** A blocky settler figure — cheap enough to draw dozens of. */
const BotBody = memo(function BotBody({
  unit,
  size,
  role,
}: {
  unit: number;
  size: number;
  role: BotRole;
}) {
  const u = unit * size;
  const tint = ROLE_TINT[role];
  return (
    <group>
      <mesh position={[0, u * 0.22, 0]}>
        <boxGeometry args={[u * 0.13, u * 0.44, u * 0.13]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
      </mesh>
      <mesh position={[0, u * 0.6, 0]}>
        <boxGeometry args={[u * 0.3, u * 0.36, u * 0.18]} />
        <meshStandardMaterial color={tint} roughness={0.75} />
      </mesh>
      <mesh position={[0, u * 0.88, 0]}>
        <boxGeometry args={[u * 0.2, u * 0.2, u * 0.2]} />
        <meshStandardMaterial color="#e6ded2" roughness={0.8} />
      </mesh>
      <mesh position={[0, u * 0.9, -u * 0.1]}>
        <boxGeometry args={[u * 0.16, u * 0.05, u * 0.02]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position={[0, u * 1.0, 0]}>
        <boxGeometry args={[u * 0.24, u * 0.06, u * 0.24]} />
        <meshStandardMaterial color={tint} roughness={0.7} />
      </mesh>
    </group>
  );
});

export function OasisBots({
  unit,
  pose,
  onBite,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
  onBite?: ((damage: number, label: string) => void) | undefined;
}) {
  const [count, setCount] = useState(() => botCount());
  useEffect(() => {
    const unsubscribe = subscribeBotCount(() => setCount(botCount()));
    return () => {
      unsubscribe();
    };
  }, []);

  const bots = useMemo(() => botRoster(count).map((plan) => makeBot(plan, unit)), [count, unit]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  /** what the labels show — refreshed on a slow timer, never every frame */
  const [chatter, setChatter] = useState<Record<number, string>>({});

  useEffect(() => {
    registerBeastGroup("bots", bots);
    return () => registerBeastGroup("bots", []);
  }, [bots]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const now = performance.now();
    let talkChanged = false;
    const talk: Record<number, string> = {};

    bots.forEach((bot, index) => {
      const node = groups.current[index];
      if (!node) return;

      if (bot.deadUntil) {
        node.rotation.set(0, bot.heading, Math.PI / 2.1);
        node.position.set(bot.x, unit * 0.02, bot.z);
        if (bot.say) {
          bot.say = null;
          talkChanged = true;
        }
        return;
      }
      node.rotation.z = 0;

      const spec = BOT_ROLES[bot.role];
      const speed = unit * (bot.role === "raider" ? 0.95 : bot.role === "trader" ? 0.18 : 0.5);
      let steer = Math.sin(now / 1_700 + bot.seed) * delta * 1.4;
      let travel = speed;

      if (bot.role === "miner") {
        // Prospectors head for the nearest live seam and chip at it.
        if (!bot.vein || bot.vein.depletedUntil || bot.vein.voxels.every((v) => !v.alive)) {
          let best: OreVein | null = null;
          let bestDistance = unit * 40;
          for (const vein of liveVeins()) {
            if (vein.depletedUntil) continue;
            const distance = Math.hypot(vein.x - bot.x, vein.z - bot.z);
            if (distance < bestDistance) {
              best = vein;
              bestDistance = distance;
            }
          }
          bot.vein = best;
        }
        const vein = bot.vein;
        if (vein) {
          const dx = vein.x - bot.x;
          const dz = vein.z - bot.z;
          const away = Math.hypot(dx, dz);
          const toVein = Math.atan2(dx, dz);
          const diff = ((toVein - bot.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 2.6);
          travel = away > unit * 1.1 ? speed : 0;
          if (away <= unit * 1.4 && now - bot.lastWork > 1_400) {
            bot.lastWork = now;
            const voxel = vein.voxels.find((v) => v.alive);
            if (voxel) mineVoxel(vein, voxel);
          }
        }
      }

      if (player) {
        const dx = player.x - bot.x;
        const dz = player.z - bot.z;
        const away = Math.hypot(dx, dz);
        const toPlayer = Math.atan2(dx, dz);

        if (bot.role === "raider" && away < unit * 14) {
          const diff = ((toPlayer - bot.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 2.4);
          travel = speed;
          const standoff = unit * 1.1;
          if (away < standoff * 1.3) travel = speed * 0.1;
          if (away < standoff * 1.8 && now - bot.lastBite > 2_600) {
            bot.lastBite = now;
            playSfx("hit");
            onBite?.(Math.round(3 + bot.size * 4), bot.label);
          }
        } else if (bot.role !== "miner" && away < unit * 2) {
          const back = toPlayer + Math.PI;
          const diff = ((back - bot.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 3);
          travel = speed * 1.1;
        } else if (bot.role === "trader" && away < unit * 9) {
          // Traders turn to face a customer and hold their pitch.
          const diff = ((toPlayer - bot.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 3);
          travel = 0;
        }

        // Walked out of sight: bring them back in around the player.
        if (away > unit * REACH) {
          const angle = bot.seed * 1.7 + now / 20_000;
          const ring = unit * (14 + (bot.id % 5) * 5);
          bot.x = player.x + Math.cos(angle) * ring;
          bot.z = player.z + Math.sin(angle) * ring;
        }
      }

      if (bot.snaredUntil && bot.snaredUntil > now) {
        steer = 0;
        travel = 0;
      }

      bot.heading += steer;
      bot.x += Math.sin(bot.heading) * travel * delta;
      bot.z += Math.cos(bot.heading) * travel * delta;
      bot.bodyY = unit * bot.size * 0.6;

      const stride = travel > 0 ? Math.abs(Math.sin(now / 170 + bot.seed)) * unit * 0.035 : 0;
      node.position.set(bot.x, stride, bot.z);
      node.rotation.y = bot.heading;
      const sinceHit = now - bot.hitAt;
      node.rotation.x = sinceHit < 240 ? -Math.sin((sinceHit / 240) * Math.PI) * 0.28 : 0;

      // Canned lines, on their own slow clock.
      if (now > bot.nextSay) {
        const lines = spec.chatter;
        const pick = lines[Math.floor(botHash(bot.id, Math.floor(now / 1_000)) * lines.length)];
        bot.say = pick ?? null;
        bot.sayUntil = now + 4_200;
        bot.nextSay = now + 9_000 + botHash(bot.id, Math.floor(now / 997)) * 22_000;
        talkChanged = true;
      } else if (bot.say && now > bot.sayUntil) {
        bot.say = null;
        talkChanged = true;
      }
      if (bot.say && player && Math.hypot(player.x - bot.x, player.z - bot.z) < unit * 16) {
        talk[bot.id] = bot.say;
      }
    });

    if (talkChanged) setChatter(talk);
  });

  return (
    <group>
      {bots.map((bot, index) => (
        <group
          key={bot.id}
          ref={(node) => {
            groups.current[index] = node;
          }}
        >
          <BotBody unit={unit} size={bot.size} role={bot.role} />
          {chatter[bot.id] ? (
            <Html
              center
              position={[0, unit * bot.size * 1.35, 0]}
              distanceFactor={0.02}
              style={{ pointerEvents: "none" }}
              zIndexRange={[8, 0]}
            >
              <div className="flex flex-col items-center gap-[2px]" data-no-translate>
                <span className="max-w-[190px] border border-border bg-background/95 px-2 py-1 font-mono text-[10px] text-foreground shadow-md">
                  {chatter[bot.id]}
                </span>
                <span className="whitespace-nowrap border border-border bg-background/90 px-1.5 py-[2px] font-mono text-[9px] uppercase text-muted-foreground">
                  {bot.name} · {BOT_ROLES[bot.role].label}
                </span>
              </div>
            </Html>
          ) : null}
        </group>
      ))}
    </group>
  );
}
