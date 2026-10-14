/** Renders the exact on-chain Guardian voxel creature (instanced, face-shaded, animated). */
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GuardianDna } from "@/lib/bitmon";
import { animVox, blueprint, onchainGenome, type Act } from "@/lib/onchain-guardian";

const noRay = () => {};
// faces shaded like the inscription's painter: top lifted, sides darkened
function shadedBox() {
  const g = new THREE.BoxGeometry(1, 1, 1), c: number[] = [];
  [0.64, 0.64, 1.22, 0.5, 0.84, 0.84].forEach((k) => { for (let i = 0; i < 4; i++) c.push(k, k, k); });
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  return g;
}

export const OnchainGuardianBody = memo(function OnchainGuardianBody({
  dna, unit = 1, moving = false, act = null,
}: { dna: GuardianDna; unit?: number; moving?: boolean; act?: Act }) {
  const G = useMemo(() => onchainGenome(dna), [dna]);
  const V = useMemo(() => blueprint(G), [G]);
  const layers = useMemo(() => [V.filter((v) => !v[7]), V.filter((v) => v[7])], [V]);
  const geo = useMemo(shadedBox, []);
  const mats = useMemo(() => [
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  ], []);
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const actRef = useRef<Act>(null);
  const clockRef = useRef(0);
  useEffect(() => { if (act) actRef.current = { k: act.k, t: clockRef.current }; }, [act]);
  useEffect(() => () => { geo.dispose(); mats.forEach((m) => m.dispose()); }, [geo, mats]);

  useEffect(() => {
    layers.forEach((l, gi) => {
      const m = refs[gi]!.current; if (!m) return;
      const col = new THREE.Color();
      l.forEach((v, i) => { col.set(v[6]); if (gi) col.multiplyScalar(1.25); m.setColorAt(i, col); });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime; clockRef.current = t;
    layers.forEach((l, gi) => {
      const m = refs[gi]!.current; if (!m) return;
      l.forEach((v, i) => {
        const a = animVox(v, t, G, moving, actRef.current);
        dummy.position.set(a[0], a[1], a[2]); dummy.scale.set(a[3] * 0.97, a[4] * 0.97, a[5] * 0.97); dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    });
  });

  // fitted creature is ≤22 voxel units tall; existing bodies are ~1.3 unit tall
  const s = (unit * 1.3) / 22;
  return (
    <group scale={s} raycast={noRay}>
      {layers.map((l, gi) => l.length ? (
        <instancedMesh key={gi} ref={refs[gi]!} args={[geo, mats[gi], l.length]} castShadow={!gi} frustumCulled={false} raycast={noRay} />
      ) : null)}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} raycast={noRay}>
        <circleGeometry args={[8, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.38} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 14, 4]} color={dna.accent} intensity={0.6} distance={40} />
    </group>
  );
});
