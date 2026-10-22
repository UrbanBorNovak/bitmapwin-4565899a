import { useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
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


const RIM_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const RIM_FRAG = /* glsl */ `
uniform float uTime; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
  float edge = 0.62 + 0.07 * n(vec2(a * 3.0, uTime * 0.8)) + 0.04 * n(vec2(a * 9.0, -uTime * 1.6));
  float d = r - edge;
  float core = exp(-d * d * 900.0);              // white-hot tear line
  float halo = exp(-max(d, 0.0) * 9.0) * step(0.0, d) + exp(d * 40.0) * step(d, 0.0) * 0.35;
  float spark = step(0.985, h(floor(vec2(a * 40.0, r * 60.0 - uTime * 6.0)))) * exp(-abs(d) * 12.0);
  vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (a / 6.2831 + d * 3.0 + uTime * 0.15 + vec3(0.0, 0.33, 0.67)));
  vec3 col = vec3(1.0) * core * 1.6 + mix(vec3(0.97,0.58,0.1), rainbow, 0.7) * halo * 1.3 + vec3(1.0,0.9,0.8) * spark * 2.0;
  float alpha = clamp(core + halo + spark, 0.0, 1.0);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col * alpha, alpha);
}`;

/** The next room, drawn only inside the gate's stencil mask so the portal shows where it leads. */
function DestWindow({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    g.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m || o.userData["portal"]) return;
      o.userData["portal"] = true;
      for (const mat of Array.isArray(m) ? m : [m]) { mat.stencilWrite = true; mat.stencilRef = 1; mat.stencilFunc = THREE.EqualStencilFunc; mat.stencilZPass = THREE.KeepStencilOp; }
      o.renderOrder = 1;
    });
  });
  // Room sits behind the gate, scaled up so its interior fills the opening.
  return <group ref={g} position={[0, -4, -96]} scale={1.4}>{children}</group>;
}

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
      let x = Math.cos(a) * rad;
      if (!vortex && Math.abs(x) < 26) x = Math.sign(x || 1) * (26 + r() * 30); // keep the walkway clear so the lead stays readable
      pos[i * 3] = x;
      pos[i * 3 + 1] = vortex ? 18 + Math.sin(a) * rad * 0.9 : -10 + r() * 110;
      pos[i * 3 + 2] = vortex ? -50 + (r() - 0.5) * 8 : -40 - r() * 160 + (r() < 0.3 ? 120 : 0);
      c.set(PALETTE[Math.floor(r() * (vortex ? 2 : PALETTE.length))]!).multiplyScalar(0.35 + r() * 0.5);
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

export function PortalSplatSet({ block, timeRef, dest }: { block: number; timeRef: MutableRefObject<number>; dest?: ReactNode }) {
  const rimMat = useRef<THREE.ShaderMaterial>(null);
  const rimU = useMemo(() => ({ uTime: { value: 0 } }), []);
  const ring = useRef<THREE.Group>(null), shards = useRef<THREE.Group>(null);
  const rocks = useMemo(() => { const r = rng(block + 101); return Array.from({ length: 22 }, () => ({
    p: [(r() - 0.5) * 140, 6 + r() * 60, -20 - r() * 110] as [number, number, number], s: 2 + r() * 7, c: r() < 0.5 ? "#3a2c22" : "#2a2f3a", ph: r() * 10 })); }, [block]);
  useFrame(() => {
    const t = timeRef.current;
    if (rimMat.current) rimMat.current.uniforms["uTime"]!.value = t;
    if (ring.current) ring.current.scale.setScalar(0.72 + Math.sin(t * 2.2) * 0.025);
    shards.current?.children.forEach((c, i) => { const k = rocks[i]!; c.position.y = k.p[1] + Math.sin(t * 0.5 + k.ph) * 2.5; c.rotation.set(t * 0.2 + k.ph, t * 0.3, 0); });
  });
  return (
    <group>
      <ambientLight intensity={0.55} color="#b8c4ff" />
      <pointLight position={[0, 18, -46]} intensity={2600} distance={160} decay={2} color="#f7931a" />
      <pointLight position={[0, 30, 20]} intensity={900} distance={120} decay={2} color="#28e0ff" />
      <Splats seed={block} timeRef={timeRef} />
      {/* glass light bridge */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[0, -0.5, 30 - i * 7]}>
          <boxGeometry args={[14, 0.6, 6.4]} />
          <meshStandardMaterial color="#9fe9ff" emissive="#28e0ff" emissiveIntensity={0.35 + (i % 2) * 0.25} transparent opacity={0.45} metalness={0.3} roughness={0.15} />
        </mesh>
      ))}
      {/* ring gate */}
      <group ref={ring} position={[0, 11, -58]}>
        {/* stencil mask: the torn opening */}
        <mesh renderOrder={0}><circleGeometry args={[17.5, 64]} /><meshBasicMaterial colorWrite={false} depthWrite={false} stencilWrite stencilRef={1} stencilFunc={THREE.AlwaysStencilFunc} stencilZPass={THREE.ReplaceStencilOp} /></mesh>
        {!dest && <mesh><circleGeometry args={[17, 48]} /><meshBasicMaterial color="#ffd9a0" transparent opacity={0.18} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>}
        {/* chromatic energy rim */}
        <mesh renderOrder={2}><planeGeometry args={[56, 56]} /><shaderMaterial ref={rimMat} uniforms={rimU} vertexShader={RIM_VERT} fragmentShader={RIM_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh>
      </group>
      {dest && <DestWindow>{dest}</DestWindow>}
      {/* drifting bedrock voxels */}
      <group ref={shards}>{rocks.map((k, i) => (
        <mesh key={i} position={k.p}><boxGeometry args={[k.s, k.s, k.s]} /><meshStandardMaterial color={k.c} emissive="#f7931a" emissiveIntensity={0.08} roughness={0.9} /></mesh>
      ))}</group>
    </group>
  );
}
