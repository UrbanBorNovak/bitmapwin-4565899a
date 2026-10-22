/** An Oasis on-chain ride/gear model parked inside a Biternam room. Click to salvage its part. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { ModelSlot } from "@/components/biternam/ModelStatus";
import { rideById } from "@/lib/world-vehicle";
import { GEAR_ITEMS, ROOM_EXHIBITS, announceGear, gearStore, salvage, type GearRoom } from "@/lib/biternam-gear";
import { playSfx } from "@/lib/retro-sfx";

function Model({ inscription, size, onEmpty }: { inscription: string; size: number; onEmpty: () => void }) {
  const gltf = useGLTF(`https://ordinals.com/content/${inscription}`);
  const obj = useMemo(() => {
    const s = clone(gltf.scene);
    s.traverse((c) => { if (/blue cube/i.test(c.name)) c.visible = false; });
    const box = new THREE.Box3().setFromObject(s);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dim.x, dim.y, dim.z, 1e-3);
    s.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    return s;
  }, [gltf.scene, size]);
  const empty = useMemo(() => { let n = 0; obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) n++; }); return n === 0; }, [obj]);
  useEffect(() => { if (empty) onEmpty(); }, [empty, onEmpty]);
  return empty ? null : <primitive object={obj} />;
}

export function OnChainExhibit({ room, position, size = 1.8, rotation = 0 }: { room: GearRoom; position: [number, number, number]; size?: number; rotation?: number }) {
  const ex = ROOM_EXHIBITS[room];
  const ride = rideById(ex.ride);
  const spin = useRef<THREE.Group>(null);
  const [hot, setHot] = useState(false);
  useFrame((_, d) => { if (spin.current) spin.current.rotation.y += Math.min(d, 0.05) * 0.35; });
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const next = salvage(gearStore.get(), room);
    if (!next) { playSfx("deny"); announceGear(`${ride.label}: nothing left to salvage.`); return; }
    gearStore.set(next);
    playSfx("pickup");
    announceGear(`Salvaged ${GEAR_ITEMS[ex.part]!.name} from the on-chain ${ride.label}. Open GEAR to combine.`);
  };
  return (
    <group position={position} rotation={[0, rotation, 0]}
      onClick={click}
      onPointerOver={(e) => { e.stopPropagation(); setHot(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHot(false); document.body.style.cursor = ""; }}>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[size * 0.62, size * 0.68, 0.12, 8]} /><meshStandardMaterial color={hot ? "#f7931a" : "#3a3a44"} flatShading /></mesh>
      <group ref={spin} position={[0, 0.12, 0]}>
        <ModelSlot url={`https://ordinals.com/content/${ride.inscription}`} size={size} label={ride.label}>
          {({ onEmpty }) => <Model inscription={ride.inscription} size={size} onEmpty={onEmpty} />}
        </ModelSlot>
      </group>
    </group>
  );
}
