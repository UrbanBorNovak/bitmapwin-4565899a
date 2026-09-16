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

import { Suspense, memo, useEffect, useMemo, useRef, useState } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";

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
import { createFlyBrain, type FlyBrain } from "@/lib/fly-brain";
import { brainProbe, publishBrainProbe } from "@/lib/fly-connectome";


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
    /** the insect-style brain that decides what this settler does next */
    brain: FlyBrain;
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
    brain: createFlyBrain(plan.seed),
  };
}

const ROLE_TINT: Record<BotRole, string> = {
  wanderer: "#cfcfcf",
  miner: "#c9a227",
  raider: "#b23b3b",
  trader: "#5aa9c9",
};

/** The plain settlers walk the sand as a real on-chain figure. */
const SETTLER_URL = contentUrl(SETTLER_INSCRIPTION);

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
  if (role === "wanderer") {
    return (
      <Suspense fallback={null}>
        <InscribedModel url={SETTLER_URL} size={unit * size * 1.05} yaw={0} />
      </Suspense>
    );
  }

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
    return () => {
      registerBeastGroup("bots", []);
      publishBrainProbe(null);
    };
  }, [bots]);


  /** when the brain readout panel was last refreshed */
  const nextProbe = useRef(0);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const now = performance.now();
    let talkChanged = false;
    const talk: Record<number, string> = {};
    const nearest: { bot: Bot | null; distance: number } = { bot: null, distance: Infinity };


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
      const speed = unit * (bot.role === "raider" ? 0.95 : bot.role === "trader" ? 0.4 : 0.5);

      if (bot.role === "miner") {
        // Prospectors keep a seam in mind and pick a new one when it runs dry.
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
      }

      const vein = bot.role === "miner" ? bot.vein : null;
      const playerDistance = player ? Math.hypot(player.x - bot.x, player.z - bot.z) / unit : null;
      if (playerDistance !== null && playerDistance < nearest.distance) {
        nearest.distance = playerDistance;
        nearest.bot = bot;
      }

      const act = bot.brain.think(
        {
          now,
          hp: bot.hp,
          maxHp: bot.maxHp,
          snared: Boolean(bot.snaredUntil && bot.snaredUntil > now),
          heading: bot.heading,
          playerDistance,
          playerAngle: player ? Math.atan2(player.x - bot.x, player.z - bot.z) : 0,
          workDistance: vein ? Math.hypot(vein.x - bot.x, vein.z - bot.z) / unit : null,
          workAngle: vein ? Math.atan2(vein.x - bot.x, vein.z - bot.z) : 0,
          worker: bot.role === "miner",
          hostile: bot.role === "raider",
          vendor: bot.role === "trader",
        },
        delta,
      );

      if (act.strike) {
        playSfx("hit");
        onBite?.(Math.round(3 + bot.size * 4), bot.label);
      }
      if (act.work && vein) {
        const voxel = vein.voxels.find((v) => v.alive);
        if (voxel) mineVoxel(vein, voxel);
      }

      // Walked out of sight: bring them back in around the player.
      if (player && playerDistance !== null && playerDistance > REACH) {
        const angle = bot.seed * 1.7 + now / 20_000;
        const ring = unit * (14 + (bot.id % 5) * 5);
        bot.x = player.x + Math.cos(angle) * ring;
        bot.z = player.z + Math.sin(angle) * ring;
      }

      const travel = speed * act.throttle;
      bot.heading += act.steer;
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

    // Publish the nearest settler's descending-neuron readout on a slow clock,
    // so the panel can show it without re-rendering every frame.
    if (now > nextProbe.current) {
      nextProbe.current = now + 220;
      const closest = nearest.bot;
      if (closest && nearest.distance < 24) {
        const firing = closest.brain.net.activity;
        let hot = 0;
        for (let i = 0; i < firing.length; i++) if (Math.abs(firing[i]!) > 0.05) hot++;
        publishBrainProbe({
          name: closest.name,
          role: BOT_ROLES[closest.role].label,
          state: closest.brain.state,
          readout: { ...closest.brain.readout },
          load: firing.length ? hot / firing.length : 0,
        });
      } else if (brainProbe()) {
        publishBrainProbe(null);
      }
    }

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
