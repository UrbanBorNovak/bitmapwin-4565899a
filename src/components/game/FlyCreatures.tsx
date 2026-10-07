/**
 * FLY-BRAIN CREATURES — the inscribed characters that live their own lives.
 *
 * One shared body for every group: an on-chain model, real health so weapons and
 * traps can touch it, and the same insect-style brain the settlers run, so each
 * one wanders, hesitates, takes breathers and flinches on its own rhythm.
 *
 * Groups differ only in the table below: how many there are, how big, how tough,
 * whether they hop, whether they keep to the water's edge, and whether the wide
 * Punk eyes go on the face.
 */

import { farFromPlayer } from "./simGate";
import { creatureCanReach } from "@/lib/creature-reach";
import { Suspense, memo, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { SafeHtml } from "@/components/game/SafeHtml";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { CreatureEyes } from "@/components/game/CreatureEyes";
import { registerBeastGroup, type BeastEntity } from "@/lib/world-entities";
import { createFlyBrain, type FlyBrain } from "@/lib/fly-brain";
import { isDeepSea, nearestSea, seaRadiusAt, type SeaMass } from "@/lib/world-sea";
import { poseDown, simDelta} from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { useQuality } from "@/graphics/QualityContext";

import { CREATURE_GROUPS, type CreatureGroupSpec } from "@/lib/bestiary";
export { CREATURE_GROUPS, type CreatureGroupSpec };

/** how far out they wander before walking back into view */
const REACH = 44;

type Creature = BeastEntity & {
  seed: number;
  heading: number;
  hop: number;
  say: string | null;
  sayUntil: number;
  nextSay: number;
  lastBite: number;
  brain: FlyBrain;
  mood: { current: "calm" | "curious" | "angry" | "hurt" };
};

function hash(a: number, b: number) {
  const n = Math.sin(a * 57.13 + b * 131.7) * 39_211.7431;
  return n - Math.floor(n);
}

function shorelinePoint(sea: SeaMass, angle: number, unit: number, index: number) {
  const edge = seaRadiusAt(sea, angle);
  const family = ((index % 6) - 2.5) * unit * 0.75;
  const depth = index % 2 === 0 ? 0.9 : 0.98;
  const x = sea.x + Math.cos(angle) * sea.rx * edge * depth - Math.sin(angle) * family;
  const z = sea.z + Math.sin(angle) * sea.rz * edge * depth + Math.cos(angle) * family;
  return { x, z };
}

function makeCreature(spec: CreatureGroupSpec, index: number, unit: number): Creature {
  const seed = hash(index + 1, spec.id.length) * 9 + index * 2.7;
  return {
    id: Number(`${spec.id.length}${index}${spec.count}`) + 20_000 + index,
    label: spec.solo ? `${spec.label} · 1/1` : spec.label,
    hostile: spec.hostile,
    hp: spec.hp,
    maxHp: spec.hp,
    x: 0,
    z: 0,
    bodyY: unit * spec.size * 0.55,
    bodyRadius: unit * spec.size * 0.3,
    xp: spec.xp,
    hitAt: 0,
    deadUntil: 0,
    seed,
    heading: seed,
    hop: seed,
    say: null,
    sayUntil: 0,
    nextSay: 5_000 + index * 6_500 + seed * 400,
    lastBite: 0,
    brain: createFlyBrain(seed),
    mood: { current: "calm" },
  };
}

export const CreatureGroup = memo(function CreatureGroup({
  spec,
  unit,
  pose,
  onBite,
  onSighted,
}: {
  spec: CreatureGroupSpec;
  unit: number;
  pose: { current: { x: number; z: number } | null };
  onBite?: ((damage: number, label: string) => void) | undefined;
  onSighted?: ((label: string, strides: number) => void) | undefined;
}) {
  const { quality } = useQuality();
  const groupLimit = quality.resolved === "low" ? 2 : quality.resolved === "medium" ? 4 : spec.count;
  const url = useMemo(() => contentUrl(spec.inscription), [spec.inscription]);
  const creatures = useMemo(
    () => Array.from({ length: Math.min(spec.count, groupLimit) }, (_, index) => makeCreature(spec, index, unit)),
    [groupLimit, spec, unit],
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  const [chatter, setChatter] = useState<Record<number, string>>({});
  const sighted = useRef(0);

  useEffect(() => {
    registerBeastGroup(`creatures:${spec.id}`, creatures);
    return () => registerBeastGroup(`creatures:${spec.id}`, []);
  }, [creatures, spec.id]);

  const simBudget = useRef(0);
  const animationFrame = useRef(0);
  useFrame((_, rawDelta) => {
    animationFrame.current = (animationFrame.current + 1) % quality.animationStride;
    if (animationFrame.current !== 0) return;
    // Flying or racing past: the crowd here is out of reach, so their brains
    // tick a few times a second instead of once a frame and travel stays smooth.
    const delta = simDelta(simBudget, rawDelta * quality.animationStride, pose);
    if (delta === null) return;
    const player = pose.current;
    const down = poseDown(pose);
    const now = performance.now();
    let talkChanged = false;
    const talk: Record<number, string> = {};
    // Nearest one of this group, reported to the readout a few times a second.
    let closest: { label: string; strides: number } | undefined;

    creatures.forEach((creature, index) => {
      const node = groups.current[index];
      if (!node) return;
      if (farFromPlayer(player, creature.x, creature.z, unit)) return;

      if (creature.deadUntil) {
        node.rotation.set(0, creature.heading, Math.PI / 2.1);
        node.position.set(creature.x, groundY(creature.x, creature.z) + unit * 0.02, creature.z);
        if (creature.say) {
          creature.say = null;
          talkChanged = true;
        }
        return;
      }
      node.rotation.z = 0;

      const away = player ? Math.hypot(player.x - creature.x, player.z - creature.z) : null;
      if (player && spec.water && creature.x === 0 && creature.z === 0) {
        const { sea } = nearestSea(player.x, player.z);
        const shoreAngle = Math.atan2(player.z - sea.z, player.x - sea.x) + (index - spec.count / 2) * 0.035;
        const home = shorelinePoint(sea, shoreAngle, unit, index);
        creature.x = home.x;
        creature.z = home.z;
      }
      const act = creature.brain.think(
        {
          now,
          hp: creature.hp,
          maxHp: creature.maxHp,
          snared: Boolean(creature.snaredUntil && creature.snaredUntil > now),
          heading: creature.heading,
          playerDistance: away === null ? null : away / unit,
          playerAngle: player ? Math.atan2(player.x - creature.x, player.z - creature.z) : 0,
          workDistance: null,
          workAngle: 0,
          worker: false,
          hostile: spec.hostile,
          vendor: false,
        },
        delta,
      );

      // Wandered right out of sight: bring them back in around the visitor, and
      // water-bound ones come back at the nearest shoreline.
      if (player && away !== null && away > unit * REACH) {
        const angle = creature.seed * 1.9 + now / 17_000;
        const ring = unit * (10 + index * 4);
        creature.x = player.x + Math.cos(angle) * ring;
        creature.z = player.z + Math.sin(angle) * ring;
        if (spec.water) {
          const { sea } = nearestSea(player.x, player.z);
          const shoreAngle = Math.atan2(player.z - sea.z, player.x - sea.x) + (index - spec.count / 2) * 0.04;
          const home = shorelinePoint(sea, shoreAngle, unit, index);
          creature.x = home.x;
          creature.z = home.z;
        }
      }

      let steer = act.steer;
      let travel = unit * spec.speed * act.throttle;

      // Water-bound: steer back toward the nearest sea whenever they stray from
      // it, so frogs and toads stay by the shoreline instead of crossing dunes.
      if (spec.water) {
        const { sea, distance } = nearestSea(creature.x, creature.z);
        if (spec.id === "wild-geese" && player) {
          const shoreAngle = Math.atan2(player.z - sea.z, player.x - sea.x) + Math.sin(now / 14_000) * 0.16;
          const home = shorelinePoint(sea, shoreAngle + (index % 8 - 3.5) * 0.035, unit, index);
          const homeDistance = Math.hypot(home.x - creature.x, home.z - creature.z);
          if (homeDistance > unit * (1.4 + (index % 6) * 0.35)) {
            const homeHeading = Math.atan2(home.x - creature.x, home.z - creature.z);
            const diff = ((homeHeading - creature.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            steer = diff * Math.min(1, delta * 2.4);
            travel = unit * spec.speed * 1.25;
          }
        } else if (distance > unit * (spec.airborne ? 0.5 : 2)) {
          // Strayed inland: turn back for the shoreline.
          const home = Math.atan2(sea.x - creature.x, sea.z - creature.z);
          const diff = ((home - creature.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 2.2);
          travel = unit * spec.speed * (spec.airborne ? 1.35 : 1);
        } else if (isDeepSea(creature.x, creature.z)) {
          // Waded out too far: turn back for the bank.
          const back = Math.atan2(creature.x - sea.x, creature.z - sea.z);
          const diff = ((back - creature.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 2.6);
        }
      }

      if (spec.hostile && !down && player && away !== null && away < unit * 9) {
        const standoff = unit * (0.8 + spec.size * 0.3);
        if (away < standoff * 1.7 && now - creature.lastBite > 2_400 && spec.bite > 0 && (spec.flying || creatureCanReach(player as { x: number; z: number; y?: number }, creature.x, creature.z, creature.bodyY ?? 0, unit))) {
          creature.lastBite = now;
          onBite?.(spec.bite, creature.label);
        }
      }

      if (creature.snaredUntil && creature.snaredUntil > now) {
        steer = 0;
        travel = 0;
      }

      creature.heading += steer;
      creature.x += Math.sin(creature.heading) * travel * delta;
      creature.z += Math.cos(creature.heading) * travel * delta;

      let lift = unit * 0.02;
      if (spec.airborne) {
        creature.hop += delta * (4.8 + spec.speed);
        const flap = Math.sin(creature.hop + index * 0.7);
        lift = unit * ((spec.altitude ?? 3) + index * 0.13 + flap * 0.28);
        node.rotation.x = -0.12 + Math.cos(creature.hop) * 0.08;
        node.rotation.z = flap * 0.18;
      } else if (spec.hops) {
        creature.hop += delta * (3.1 + spec.speed) * (0.7 + act.throttle * 0.7);
        const swing = Math.abs(Math.sin(creature.hop));
        lift = unit * spec.size * (0.04 + swing * (0.34 + act.throttle * 0.3));
        node.rotation.x = -swing * 0.14;
      } else {
        node.rotation.x = 0;
        lift = Math.abs(Math.sin(now / 200 + creature.seed)) * unit * spec.size * 0.02;
      }
      creature.bodyY = lift + unit * spec.size * 0.5;

      // Nudge a body out of the visitor so nothing ever overlaps the camera.
      if (player && away !== null) {
        const standoff = unit * (0.6 + spec.size * 0.3);
        if (away < standoff) {
          const dx = creature.x - player.x;
          const dz = creature.z - player.z;
          const span = Math.hypot(dx, dz) || 0.0001;
          creature.x = player.x + (dx / span) * standoff;
          creature.z = player.z + (dz / span) * standoff;
        }
      }

      node.position.set(creature.x, groundY(creature.x, creature.z) + lift, creature.z);
      node.rotation.y = creature.heading;
      const sinceHit = now - creature.hitAt;
      if (sinceHit < 250) node.rotation.x -= Math.sin((sinceHit / 250) * Math.PI) * 0.3;

      if (away !== null && away < unit * 12) {
        const strides = away / unit;
        if (!closest || strides < closest.strides) closest = { label: creature.label, strides };
      }

      creature.mood.current =
        sinceHit < 1_400
          ? "hurt"
          : spec.hostile && away !== null && away < unit * 10
            ? "angry"
            : away !== null && away < unit * 5
              ? "curious"
              : "calm";

      if (spec.lines.length > 0) {
        if (now > creature.nextSay) {
          creature.say =
            spec.lines[Math.floor(hash(creature.seed, Math.floor(now / 1_000)) * spec.lines.length)] ??
            null;
          creature.sayUntil = now + 4_200;
          creature.nextSay = now + 13_000 + hash(creature.seed, index) * 20_000;
          talkChanged = true;
        } else if (creature.say && now > creature.sayUntil) {
          creature.say = null;
          talkChanged = true;
        }
        if (creature.say && away !== null && away < unit * 17) talk[creature.id] = creature.say;
      }
    });

    if (talkChanged) setChatter(talk);
    if (closest && now - sighted.current > 320) {
      sighted.current = now;
      onSighted?.(closest.label, closest.strides);
    }
  });

  return (
    <group>
      {creatures.map((creature, index) => (
        <group
          key={creature.id}
          ref={(node) => {
            groups.current[index] = node;
          }}
        >
          <Suspense fallback={null}>
            <InscribedModel url={url} size={unit * spec.size} yaw={spec.modelYaw ?? 0} />
          </Suspense>
          {spec.eyes ? (
            <CreatureEyes unit={unit} size={spec.size} seed={creature.seed} mood={creature.mood} />
          ) : null}
          {chatter[creature.id] ? (
            <SafeHtml
              center
              position={[0, unit * spec.size * 1.45, 0]}
              distanceFactor={0.02}
              style={{ pointerEvents: "none" }}
              zIndexRange={[8, 0]}
            >
              <div className="flex flex-col items-center gap-[2px]" data-no-translate>
                <span className="max-w-[190px] border border-border bg-background/95 px-2 py-1 font-mono text-[10px] text-foreground shadow-md">
                  {chatter[creature.id]}
                </span>
                <span className="whitespace-nowrap border border-border bg-background/90 px-1.5 py-[2px] font-mono text-[9px] uppercase text-muted-foreground">
                  {creature.label}
                </span>
              </div>
            </SafeHtml>
          ) : null}
        </group>
      ))}
    </group>
  );
});

/** Every fly-brain group in the world. */
export const FlyCreatures = memo(function FlyCreatures({
  unit,
  pose,
  onBite,
  onSighted,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
  onBite?: ((damage: number, label: string) => void) | undefined;
  onSighted?: ((label: string, strides: number) => void) | undefined;
}) {
  return (
    <>
      {CREATURE_GROUPS.map((spec) => (
        <CreatureGroup
          key={spec.id}
          spec={spec}
          unit={unit}
          pose={pose}
          onBite={onBite}
          onSighted={onSighted}
        />
      ))}
    </>
  );
});

for (const spec of CREATURE_GROUPS) useGLTF.preload(contentUrl(spec.inscription));
