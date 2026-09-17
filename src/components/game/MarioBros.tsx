/**
 * MARIO BROS — a single 1/1 specimen, the only one of its kind in the Oasis.
 *
 * It runs the same insect-style brain the settlers use, so it wanders, backs
 * off and takes breathers on its own — and it never stops jumping. Strikeable,
 * with huge experience, but peaceful: it will not come at you.
 */

import { Suspense, memo, useEffect, useMemo, useRef, useState } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { registerBeastGroup, type BeastEntity } from "@/lib/world-entities";
import { createFlyBrain, type FlyBrain } from "@/lib/fly-brain";
import { dryLandNear, isSea } from "@/lib/world-sea";

export const BROS_INSCRIPTION =
  "ae759a6fba1e5bcd02bd74db802cd4c8d8f07d77ba1ce2327c9032072bf9f1b6i0";

const BROS_URL = contentUrl(BROS_INSCRIPTION);

/** how far out they wander before hopping back into view */
const REACH = 40;

type Bro = BeastEntity & {
  name: string;
  seed: number;
  size: number;
  heading: number;
  /** the jump clock — they are airborne most of the time */
  hop: number;
  hopSpeed: number;
  say: string | null;
  sayUntil: number;
  nextSay: number;
  brain: FlyBrain;
};

const LINES = [
  "ONE OF ONE, JUST LIKE MY BROTHER",
  "NICE BLOCK — ANY PIPES IN IT?",
  "KEEP JUMPING, KEEP MOVING",
  "MAMMA MIA, THAT IS A LOT OF SAND",
];

function makeBro(index: number, name: string, unit: number): Bro {
  const size = index === 0 ? 1.05 : 1.12;
  const hp = 240;
  return {
    id: 9_500 + index,
    label: `${name} · 1/1`,
    hostile: false,
    hp,
    maxHp: hp,
    x: 0,
    z: 0,
    bodyY: unit * size * 0.6,
    bodyRadius: unit * size * 0.32,
    xp: 640,
    hitAt: 0,
    deadUntil: 0,
    name,
    seed: 3.1 + index * 5.7,
    size,
    heading: index * 2.1,
    hop: index * 0.8,
    hopSpeed: 2.6 + index * 0.35,
    say: null,
    sayUntil: 0,
    nextSay: 4_000 + index * 7_000,
    brain: createFlyBrain(3.1 + index * 5.7),
  };
}

export const MarioBros = memo(function MarioBros({
  unit,
  pose,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
}) {
  // A single specimen: there is only one of these in the whole Oasis.
  const bros = useMemo(() => [makeBro(0, "MARIO BROS", unit)], [unit]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const [chatter, setChatter] = useState<Record<number, string>>({});

  useEffect(() => {
    registerBeastGroup("bros", bros);
    return () => registerBeastGroup("bros", []);
  }, [bros]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const now = performance.now();
    let talkChanged = false;
    const talk: Record<number, string> = {};

    bros.forEach((bro, index) => {
      const node = groups.current[index];
      if (!node) return;

      if (bro.deadUntil) {
        node.rotation.set(0, bro.heading, Math.PI / 2.1);
        node.position.set(bro.x, unit * 0.02, bro.z);
        if (bro.say) {
          bro.say = null;
          talkChanged = true;
        }
        return;
      }
      node.rotation.z = 0;

      const playerDistance = player ? Math.hypot(player.x - bro.x, player.z - bro.z) / unit : null;
      const act = bro.brain.think(
        {
          now,
          hp: bro.hp,
          maxHp: bro.maxHp,
          snared: Boolean(bro.snaredUntil && bro.snaredUntil > now),
          heading: bro.heading,
          playerDistance,
          playerAngle: player ? Math.atan2(player.x - bro.x, player.z - bro.z) : 0,
          workDistance: null,
          workAngle: 0,
          worker: false,
          hostile: false,
          vendor: false,
        },
        delta,
      );

      if (player && playerDistance !== null && playerDistance > REACH) {
        const angle = bro.seed * 2.3 + now / 18_000;
        const ring = unit * (12 + index * 4);
        const dry = dryLandNear(
          player.x + Math.cos(angle) * ring,
          player.z + Math.sin(angle) * ring,
          unit * 260,
          bro.seed,
        );
        if (dry) {
          bro.x = dry.x;
          bro.z = dry.z;
        }
      }

      const travel = unit * 1.15 * act.throttle;
      bro.heading += act.steer;
      bro.x += Math.sin(bro.heading) * travel * delta;
      bro.z += Math.cos(bro.heading) * travel * delta;
      if (isSea(bro.x, bro.z)) {
        const dry = dryLandNear(bro.x, bro.z, unit * 260, bro.seed + now / 1000);
        if (dry) {
          bro.x = dry.x;
          bro.z = dry.z;
          bro.heading += Math.PI * 0.7;
        }
      }

      // Always bouncing: a full hop cycle even while standing still, higher and
      // faster while they are on the run.
      bro.hop += delta * bro.hopSpeed * (0.75 + act.throttle * 0.6);
      const swing = Math.abs(Math.sin(bro.hop));
      const lift = unit * bro.size * (0.06 + swing * (0.5 + act.throttle * 0.35));
      bro.bodyY = lift + unit * bro.size * 0.5;

      node.position.set(bro.x, lift, bro.z);
      node.rotation.y = bro.heading;
      // Tuck the knees at the top of the arc and land square.
      node.rotation.x = -swing * 0.16;
      const sinceHit = now - bro.hitAt;
      if (sinceHit < 240) node.rotation.x -= Math.sin((sinceHit / 240) * Math.PI) * 0.3;

      if (now > bro.nextSay) {
        bro.say = LINES[Math.floor((Math.sin(now / 900 + bro.seed) * 0.5 + 0.5) * LINES.length)] ?? null;
        bro.sayUntil = now + 4_200;
        bro.nextSay = now + 14_000 + index * 6_000;
        talkChanged = true;
      } else if (bro.say && now > bro.sayUntil) {
        bro.say = null;
        talkChanged = true;
      }
      if (bro.say && player && Math.hypot(player.x - bro.x, player.z - bro.z) < unit * 18) {
        talk[bro.id] = bro.say;
      }
    });

    if (talkChanged) setChatter(talk);
  });

  return (
    <group>
      {bros.map((bro, index) => (
        <group
          key={bro.id}
          ref={(node) => {
            groups.current[index] = node;
          }}
        >
          <Suspense fallback={null}>
            <InscribedModel url={BROS_URL} size={unit * bro.size * 1.05} yaw={0} />
          </Suspense>
          {chatter[bro.id] ? (
            <Html
              center
              position={[0, unit * bro.size * 1.5, 0]}
              distanceFactor={0.02}
              style={{ pointerEvents: "none" }}
              zIndexRange={[8, 0]}
            >
              <div className="flex flex-col items-center gap-[2px]" data-no-translate>
                <span className="max-w-[190px] border border-border bg-background/95 px-2 py-1 font-mono text-[10px] text-foreground shadow-md">
                  {chatter[bro.id]}
                </span>
                <span className="whitespace-nowrap border border-border bg-background/90 px-1.5 py-[2px] font-mono text-[9px] uppercase text-muted-foreground">
                  {bro.name} · 1/1
                </span>
              </div>
            </Html>
          ) : null}
        </group>
      ))}
    </group>
  );
});

useGLTF.preload(BROS_URL);
