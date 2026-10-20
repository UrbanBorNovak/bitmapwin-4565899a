/** Wandering Agent Colony citizens in the Oasis, placed by citizenAt(clock). */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { CITIZENS, citizenAt, type Citizen } from "@/lib/agent-colony";
import { groundY } from "@/lib/world-terrain";

function Walker({ c, unit }: { c: Citizen; unit: number }) {
  const g = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const s = unit * 1.3;
  useFrame(() => {
    const t = Date.now() / 1000;
    const st = citizenAt(c, t);
    if (g.current) { g.current.position.set(st.x, groundY(st.x, st.z), st.z); g.current.rotation.y = st.yaw; }
    const swing = st.moving ? Math.sin(t * 9) * 0.6 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
  });
  return (
    <group ref={g}>
      <group ref={legL} position={[-s * 0.1, s * 0.5, 0]}><mesh position-y={-s * 0.25}><boxGeometry args={[s * 0.14, s * 0.5, s * 0.16]} /><meshStandardMaterial color="#2a2a30" /></mesh></group>
      <group ref={legR} position={[s * 0.1, s * 0.5, 0]}><mesh position-y={-s * 0.25}><boxGeometry args={[s * 0.14, s * 0.5, s * 0.16]} /><meshStandardMaterial color="#2a2a30" /></mesh></group>
      <mesh position={[0, s * 0.75, 0]}><boxGeometry args={[s * 0.4, s * 0.5, s * 0.24]} /><meshStandardMaterial color={c.color} /></mesh>
      <mesh position={[0, s * 1.16, 0]}><boxGeometry args={[s * 0.3, s * 0.3, s * 0.28]} /><meshStandardMaterial color="#e8d2b6" /></mesh>
    </group>
  );
}

export function ColonyCitizens({ unit }: { unit: number }) {
  return <>{CITIZENS.map((c) => <Walker key={c.id} c={c} unit={unit} />)}</>;
}
