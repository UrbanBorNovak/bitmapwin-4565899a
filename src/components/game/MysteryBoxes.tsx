/**
 * MYSTERY BOXES lying out in the sand.
 *
 * Inscribed crates, placed from the tile and the UTC day so everyone finds the
 * same ones and a fresh run appears daily. Walk into one and it cracks open,
 * paying out something at random: a purse of BIT, a ration, or mining experience.
 */

import { Suspense, memo, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { playSfx } from "@/lib/world-audio";
import {
  MYSTERY_INSCRIPTION,
  MYSTERY_REACH,
  MYSTERY_TILE,
  mysteryDay,
  mysteryHash,
  mysteryOpened,
  openMystery,
  type MysteryPrize,
} from "@/lib/world-mystery";

const BOX_URL = contentUrl(MYSTERY_INSCRIPTION);
const noRaycast = () => {};

/** how many tiles out from the visitor crates are drawn */
const SPREAD = 2;

type Box = { id: string; x: number; z: number; yaw: number; roll: number };

export const MysteryBoxes = memo(function MysteryBoxes({
  unit,
  pose,
  onPrize,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
  onPrize?: ((prize: MysteryPrize) => void) | undefined;
}) {
  const tile = unit * MYSTERY_TILE;
  const day = mysteryDay();
  const [centre, setCentre] = useState({ tx: 0, tz: 0 });
  const [opened, setOpened] = useState(0);

  const boxes = useMemo(() => {
    const list: Box[] = [];
    for (let dx = -SPREAD; dx <= SPREAD; dx++) {
      for (let dz = -SPREAD; dz <= SPREAD; dz++) {
        const tx = centre.tx + dx;
        const tz = centre.tz + dz;
        // Roughly one tile in five hides a crate — they are meant to be a find.
        if (mysteryHash(tx, tz, 5) > 0.2) continue;
        const id = `${day}:${tx}:${tz}`;
        if (mysteryOpened(id)) continue;
        list.push({
          id,
          x: (tx + 0.2 + mysteryHash(tx, tz, 9) * 0.6) * tile,
          z: (tz + 0.2 + mysteryHash(tx, tz, 17) * 0.6) * tile,
          yaw: mysteryHash(tx, tz, 23) * Math.PI * 2,
          roll: mysteryHash(tx, tz, 29),
        });
      }
    }
    return list;
    // `opened` re-reads the field the moment a crate is cracked.
  }, [centre, day, tile, opened]);

  const groups = useRef<(THREE.Group | null)[]>([]);
  const check = useRef(0);

  useFrame(({ clock }, delta) => {
    boxes.forEach((box, index) => {
      const node = groups.current[index];
      if (!node) return;
      // A slow hover and turn so a crate catches the eye across the dunes.
      node.rotation.y += delta * 0.35;
      node.position.y = unit * (0.16 + Math.sin(clock.elapsedTime * 1.4 + box.roll * 6) * 0.05);
    });

    const player = pose.current;
    if (!player) return;
    check.current -= delta;
    if (check.current > 0) return;
    check.current = 0.15;

    const tx = Math.floor(player.x / tile);
    const tz = Math.floor(player.z / tile);
    if (tx !== centre.tx || tz !== centre.tz) setCentre({ tx, tz });

    const reach = unit * MYSTERY_REACH;
    for (const box of boxes) {
      if (Math.hypot(player.x - box.x, player.z - box.z) > reach) continue;
      const prize = openMystery(box.id, box.roll);
      if (!prize) continue;
      playSfx(prize.kind === "nothing" ? "thud" : "chest");
      setOpened((n) => n + 1);
      onPrize?.(prize);
      break;
    }
  });

  return (
    <group>
      {boxes.map((box, index) => (
        <group
          key={box.id}
          position={[box.x, 0, box.z]}
          ref={(node) => {
            groups.current[index] = node;
          }}
        >
          <Suspense
            fallback={
              <mesh position={[0, unit * 0.25, 0]} raycast={noRaycast}>
                <boxGeometry args={[unit * 0.4, unit * 0.4, unit * 0.4]} />
                <meshLambertMaterial color="#f7931a" flatShading />
              </mesh>
            }
          >
            <InscribedModel url={BOX_URL} size={unit * 0.7} yaw={box.yaw} />
          </Suspense>
        </group>
      ))}
    </group>
  );
});

useGLTF.preload(BOX_URL);
