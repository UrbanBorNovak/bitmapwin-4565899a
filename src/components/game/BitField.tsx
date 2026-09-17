/**
 * BITS LYING IN THE SAND.
 *
 * A loose scatter of inscribed BITs around wherever the visitor happens to be.
 * Each tile of ground either holds one or it doesn't, decided from the tile and
 * the UTC day, so the scatter is the same for everyone and the whole field stands
 * back up once a day. Walk over one and it goes in your purse.
 */

import { Suspense, memo, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { playSfx } from "@/lib/world-audio";
import {
  MEMBER_BIT_CHANCE,
  MEMBER_BIT_PAYOUT,
  isMember,
  useMember,
} from "@/lib/world-perks";
import {
  BIT_INSCRIPTION,
  BIT_REACH,
  BIT_TILE,
  bitHash,
  bitPicked,
  bitsDay,
  creditBits,
  pickBit,
} from "@/lib/world-bits";
import { isSea } from "@/lib/world-sea";
import { groundY } from "@/lib/world-terrain";

const BIT_URL = contentUrl(BIT_INSCRIPTION);
const noRaycast = () => {};
const GOLD = "#f7931a";

/** how many tiles out from the visitor BITs are drawn */
const SPREAD = 3;

type Bit = { id: string; x: number; z: number; spin: number };

export const BitField = memo(function BitField({
  unit,
  pose,
  onPick,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
  onPick?: ((total: string) => void) | undefined;
}) {
  const tile = unit * BIT_TILE;
  const day = bitsDay();
  const member = useMember();
  const [centre, setCentre] = useState({ tx: 0, tz: 0 });
  const [taken, setTaken] = useState(0);

  const bits = useMemo(() => {
    const list: Bit[] = [];
    for (let dx = -SPREAD; dx <= SPREAD; dx++) {
      for (let dz = -SPREAD; dz <= SPREAD; dz++) {
        const tx = centre.tx + dx;
        const tz = centre.tz + dz;
        // Roughly two tiles in five hold a BIT — more of them for MEMBERS.
        if (bitHash(tx, tz, 3) > (member ? MEMBER_BIT_CHANCE : 0.42)) continue;
        const id = `${day}:${tx}:${tz}`;
        if (bitPicked(id)) continue;
        const x = (tx + 0.15 + bitHash(tx, tz, 7) * 0.7) * tile;
        const z = (tz + 0.15 + bitHash(tx, tz, 11) * 0.7) * tile;
        if (isSea(x, z)) continue;
        list.push({ id, x, z, spin: 0.6 + bitHash(tx, tz, 13) * 1.4 });
      }
    }
    return list;
    // `taken` re-reads the field the moment one is pocketed.
  }, [centre, day, member, tile, taken]);

  const groups = useRef<(THREE.Group | null)[]>([]);
  const check = useRef(0);

  useFrame(({ clock }, delta) => {
    const player = pose.current;
    bits.forEach((bit, index) => {
      const node = groups.current[index];
      if (!node) return;
      node.rotation.y += delta * bit.spin;
      node.position.y = groundY(bit.x, bit.z) + unit * (0.3 + Math.sin(clock.elapsedTime * 2 + bit.spin * 3) * 0.06);
    });
    if (!player) return;

    check.current -= delta;
    if (check.current > 0) return;
    check.current = 0.12;

    const tx = Math.floor(player.x / tile);
    const tz = Math.floor(player.z / tile);
    if (tx !== centre.tx || tz !== centre.tz) setCentre({ tx, tz });

    const reach = unit * BIT_REACH;
    for (const bit of bits) {
      if (Math.hypot(player.x - bit.x, player.z - bit.z) > reach) continue;
      if (!pickBit(bit.id)) continue;
      playSfx("nugget");
      setTaken((n) => n + 1);
      // MEMBERS pocket more from the same BIT lying in the sand.
      if (isMember()) {
        creditBits(MEMBER_BIT_PAYOUT - 1);
        onPick?.(`BIT PICKED UP ×${MEMBER_BIT_PAYOUT} · MEMBER`);
      } else {
        onPick?.("BIT PICKED UP");
      }
      break;
    }
  });

  return (
    <group>
      {bits.map((bit, index) => (
        <group
          key={bit.id}
          position={[bit.x, 0, bit.z]}
          ref={(node) => {
            groups.current[index] = node;
          }}
        >
          <Suspense
            fallback={
              <mesh raycast={noRaycast}>
                <sphereGeometry args={[unit * 0.07, 8, 6]} />
                <meshLambertMaterial color={GOLD} flatShading />
              </mesh>
            }
          >
            <InscribedModel url={BIT_URL} size={unit * 0.24} />
          </Suspense>
        </group>
      ))}
    </group>
  );
});

useGLTF.preload(BIT_URL);
