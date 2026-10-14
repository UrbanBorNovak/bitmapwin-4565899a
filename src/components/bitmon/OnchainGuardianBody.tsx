/** Renders the exact on-chain Guardian voxel creature (instanced, face-shaded, animated). */
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GuardianDna } from "@/lib/bitmon";
import { animVox, blueprint, onchainGenome, type Act } from "@/lib/onchain-guardian";

const noRay = () => {};
// Faces shaded exactly like the inscription's 2D painter, in sRGB space:
// x sides mix 36% black, z sides 16% black, top mixes white (20%, glow 30%).
// Codes: <0 darken by |s|, 1 = "top" (uses the material's lift).
function shadedBox() {
  const g = new THREE.BoxGeometry(1, 1, 1), c: number[] = [];
  [-0.36, -0.36, 1, -0.5, -0.16, -0.16].forEach((k) => { for (let i = 0; i < 4; i++) c.push(k); });
  g.setAttribute("shade", new THREE.Float32BufferAttribute(c, 1));
  return g;
}
function painterMaterial(lift: number) {
  const m = new THREE.MeshBasicMaterial({ toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float shade;\nvarying float vShade;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvShade = shade;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vShade;")
      .replace("#include <color_fragment>", `#include <color_fragment>
      vec3 sg = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
      sg = vShade > 0.5 ? mix(sg, vec3(1.0), ${lift.toFixed(2)}) : sg * (1.0 + vShade);
      diffuseColor.rgb = pow(sg, vec3(2.2));`);
  };
  return m;
}

export const OnchainGuardianBody = memo(function OnchainGuardianBody({
  dna, unit = 1, moving = false, act = null,
}: { dna: GuardianDna; unit?: number; moving?: boolean; act?: Act }) {
  const G = useMemo(() => onchainGenome(dna), [dna]);
  const V = useMemo(() => blueprint(G), [G]);
  const layers = useMemo(() => [V.filter((v) => !v[7]), V.filter((v) => v[7])], [V]);
  const geo = useMemo(shadedBox, []);
  const mats = useMemo(() => [painterMaterial(0.2), painterMaterial(0.3)], []);
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
