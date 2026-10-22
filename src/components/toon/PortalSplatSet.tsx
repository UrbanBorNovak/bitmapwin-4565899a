import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Floating Gaussian-splat style portal: thousands of soft additive billboards (e^-r² falloff),
 * drifting bedrock voxels and a glass light bridge into a ring gate. Seeded by block height;
 * all motion reads the timeline so scrubbing and export match. */
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
const PALETTE = ["#f7931a", "#28e0ff", "#ffcf8a", "#7a4dff", "#ffffff"];

const VERT = /* glsl */ `
uniform float uTime; attribute float aSize; attribute float aPhase; varying vec3 vColor; varying float vFade;
void main() {
  vColor = color;
  vec3 p = position;
  p.y += sin(uTime * 0.6 + aPhase) * 1.6;
  p.x += cos(uTime * 0.4 + aPhase * 1.3) * 1.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  vFade = smoothstep(320.0, 40.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec3 vColor; varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0;
  float a = exp(-r2 * 4.0) * vFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, a);
}`;

function Splats({ seed, timeRef }: { seed: number; timeRef: MutableRefObject<number> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const r = rng(seed * 7919 + 13), N = 3500;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      // Two clusters: a swirling vortex around the gate and a wide nebula shell.
      const vortex = i < N * 0.45;
      const a = r() * Math.PI * 2, rad = vortex ? 14 + r() * 26 : 40 + r() * 120;
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = vortex ? 22 + Math.sin(a) * rad * 0.9 : -10 + r() * 110;
      pos[i * 3 + 2] = vortex ? -60 + (r() - 0.5) * 10 : -40 - r() * 160 + (r() < 0.3 ? 120 : 0);
      c.set(PALETTE[Math.floor(r() * (vortex ? 2 : PALETTE.length))]!).multiplyScalar(0.5 + r() * 0.7);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = vortex ? 3 + r() * 6 : 6 + r() * 18;
      phase[i] = r() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    return g;
  }, [seed]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(() => { if (mat.current) mat.current.uniforms["uTime"]!.value = timeRef.current; });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export function PortalSplatSet({ block, timeRef }: { block: number; timeRef: MutableRefObject<number> }) {
  const ring = useRef<THREE.Group>(null), shards = useRef<THREE.Group>(null);
  const rocks = useMemo(() => { const r = rng(block + 101); return Array.from({ length: 22 }, () => ({
    p: [(r() - 0.5) * 140, 6 + r() * 60, -20 - r() * 110] as [number, number, number], s: 2 + r() * 7, c: r() < 0.5 ? "#3a2c22" : "#2a2f3a", ph: r() * 10 })); }, [block]);
  useFrame(() => {
    const t = timeRef.current;
    if (ring.current) { ring.current.rotation.z = t * 0.35; ring.current.children[1]!.rotation.z = -t * 0.8; }
    shards.current?.children.forEach((c, i) => { const k = rocks[i]!; c.position.y = k.p[1] + Math.sin(t * 0.5 + k.ph) * 2.5; c.rotation.set(t * 0.2 + k.ph, t * 0.3, 0); });
  });
  return (
    <group>
      <ambientLight intensity={0.55} color="#b8c4ff" />
      <pointLight position={[0, 22, -55]} intensity={2600} distance={160} decay={2} color="#f7931a" />
      <pointLight position={[0, 30, 20]} intensity={900} distance={120} decay={2} color="#28e0ff" />
      <Splats seed={block} timeRef={timeRef} />
      {/* glass light bridge */}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[0, -0.5, 30 - i * 7]}>
          <boxGeometry args={[14, 0.6, 6.4]} />
          <meshStandardMaterial color="#9fe9ff" emissive="#28e0ff" emissiveIntensity={0.35 + (i % 2) * 0.25} transparent opacity={0.45} metalness={0.3} roughness={0.15} />
        </mesh>
      ))}
      {/* ring gate */}
      <group ref={ring} position={[0, 22, -60]}>
        <mesh><torusGeometry args={[20, 1.2, 12, 64]} /><meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={1.6} /></mesh>
        <mesh><torusGeometry args={[16, 0.4, 8, 6]} /><meshStandardMaterial color="#28e0ff" emissive="#28e0ff" emissiveIntensity={1.4} /></mesh>
        <mesh><circleGeometry args={[19, 48]} /><meshBasicMaterial color="#ffd9a0" transparent opacity={0.18} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      </group>
      {/* drifting bedrock voxels */}
      <group ref={shards}>{rocks.map((k, i) => (
        <mesh key={i} position={k.p}><boxGeometry args={[k.s, k.s, k.s]} /><meshStandardMaterial color={k.c} emissive="#f7931a" emissiveIntensity={0.08} roughness={0.9} /></mesh>
      ))}</group>
    </group>
  );
}
