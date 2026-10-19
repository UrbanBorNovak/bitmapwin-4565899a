import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cueSeed, particleAt, sampleKeys, type ToonVFX, type VfxCue } from "@/lib/toon-vfx";

const GEOS = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  quad: () => new THREE.PlaneGeometry(1, 1),
  spark: () => new THREE.BoxGeometry(0.25, 1, 0.25),
};

/** One cue = one InstancedMesh = one draw call. */
function Cue({ fx, cue, seed, timeRef }: { fx: ToonVFX; cue: VfxCue; seed: number; timeRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => GEOS[fx.shape](), [fx.shape]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, toneMapped: false, vertexColors: false,
    blending: fx.blend === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending,
  }), [fx.blend]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), c2: new THREE.Color() }), []);
  const sc = cue.scale ?? 1;

  useFrame(({ camera }) => {
    const m = mesh.current; if (!m) return;
    const t = timeRef.current - cue.at;
    let op = 0, n = 0;
    for (let i = 0; i < fx.count; i++) {
      const p = particleAt(fx, seed, i, t);
      if (!p.alive) { tmp.s.set(0, 0, 0); tmp.p.set(0, -9999, 0); }
      else {
        const k = sampleKeys(fx.keys, p.u);
        tmp.p.set((cue.x ?? 0) + p.x * sc, (cue.y ?? 0) + p.y * sc, (cue.z ?? 0) + p.z * sc);
        const s = k.scale * sc; tmp.s.set(s, s, s);
        tmp.c.set(k.a.color).lerp(tmp.c2.set(k.b.color), k.f).multiplyScalar(Math.max(0.05, k.opacity));
        m.setColorAt(i, tmp.c); op += k.opacity; n++;
      }
      if (fx.shape === "quad") tmp.q.copy(camera.quaternion); else tmp.q.identity();
      tmp.m.compose(tmp.p, tmp.q, tmp.s); m.setMatrixAt(i, tmp.m);
    }
    mat.opacity = n ? Math.min(1, op / n + 0.15) : 0;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.visible = n > 0;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, fx.count]} frustumCulled={false} />;
}

export function ToonVFXLayer({ cues, lib, scene, timeRef }: { cues?: VfxCue[] | undefined; lib: Map<string, ToonVFX>; scene: number; timeRef: MutableRefObject<number> }) {
  return <>{(cues ?? []).map((c, i) => {
    const fx = lib.get(c.id);
    return fx ? <Cue key={`${scene}-${i}-${c.id}`} fx={fx} cue={c} seed={cueSeed(scene, i)} timeRef={timeRef} /> : null;
  })}</>;
}
