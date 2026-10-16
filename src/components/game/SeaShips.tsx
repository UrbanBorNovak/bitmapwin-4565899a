/**
 * SEA SHIPS — inscribed ships sailing slow loops across each sea.
 * Courses are seeded from the sea id, so every visitor sees the same fleet.
 */
import { Component, memo, Suspense, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEAS, seaRadiusAt, type SeaMass } from "@/lib/world-sea";
import { waterSurfaceY } from "@/lib/world-terrain";
import type { PlayerState } from "@/lib/player-state";
import { InscribedModel, contentUrl } from "./InscribedParts";

const SHIP_INSCRIPTION = "f052b807840ed3a051a253e43128b0c1a5f75f87221e2e69253a569f8f0d7726i0";

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function seed(n: number, salt: number) {
  const v = Math.sin(n * 91.7 + salt * 213.3) * 43758.5453;
  return v - Math.floor(v);
}

type Ship = { sea: SeaMass; size: number; ring: number; speed: number; phase: number };

export const SeaShips = memo(function SeaShips({
  unit,
  pose,
}: {
  unit: number;
  pose: React.MutableRefObject<PlayerState | null>;
}) {
  const group = useRef<THREE.Group>(null);
  const ships = useMemo<Ship[]>(() => {
    const out: Ship[] = [];
    for (const sea of SEAS) {
      const count = 1 + Math.floor(seed(sea.id, 1) * 2);
      for (let i = 0; i < count; i++) {
        const s = sea.id * 5 + i;
        out.push({
          sea,
          size: unit * (4 + seed(s, 2) * 2),
          ring: 0.45 + seed(s, 3) * 0.25,
          speed: (0.012 + seed(s, 4) * 0.01) * (seed(s, 5) > 0.5 ? 1 : -1),
          phase: seed(s, 6) * Math.PI * 2,
        });
      }
    }
    return out;
  }, [unit]);

  useFrame(({ clock }) => {
    const node = group.current;
    const player = pose.current;
    if (!node) return;
    const t = clock.elapsedTime;
    const range = unit * 260;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const ship = ships[i]!;
      const { sea } = ship;
      const a = ship.phase + t * ship.speed;
      const r = seaRadiusAt(sea, a) * ship.ring;
      const x = sea.x + Math.cos(a) * sea.rx * r;
      const z = sea.z + Math.sin(a) * sea.rz * r;
      if (player && Math.hypot(player.x - x, player.z - z) > range) {
        child.visible = false;
        continue;
      }
      child.visible = true;
      // Heading follows the tangent of the loop.
      const dx = -Math.sin(a) * sea.rx * Math.sign(ship.speed);
      const dz = Math.cos(a) * sea.rz * Math.sign(ship.speed);
      const bob = Math.sin(t * 1.3 + ship.phase) * unit * 0.08;
      child.position.set(x, waterSurfaceY(sea.x, sea.z) - ship.size * 0.12 + bob, z);
      child.rotation.set(Math.sin(t * 0.9 + ship.phase) * 0.04, Math.atan2(dx, dz), Math.sin(t * 1.1 + ship.phase) * 0.05);
    }
  });

  return (
    <group ref={group}>
      {ships.map((ship, i) => (
        <group key={i}>
          <Quiet>
            <Suspense fallback={null}>
              <InscribedModel url={contentUrl(SHIP_INSCRIPTION)} size={ship.size} />
            </Suspense>
          </Quiet>
        </group>
      ))}
    </group>
  );
});
