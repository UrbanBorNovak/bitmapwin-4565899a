import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, Color, Object3D, type InstancedMesh, Path, Shape, DoubleSide, RepeatWrapping, SRGBColorSpace, type Group, type Mesh, type PointLight, type ShaderMaterial } from "three";

/** Deterministic pseudo-random so the set is identical every play, scrub and export. */
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
const smooth = (a: number, b: number, x: number) => { const q = Math.max(0, Math.min(1, (x - a) / (b - a))); return q * q * (3 - 2 * q); };

export const PORTAL = { x: 0, y: 17, z: -29, r: 15 };

/** Sunlit voxel Oasis: hills, water, block towers and floating sats. Used inside the portal and as the arrival set. */
export function OasisWorld({ timeRef, lit = true }: { timeRef: MutableRefObject<number>; lit?: boolean }) {
  const sats = useRef<Group>(null), hills = useRef<InstancedMesh>(null);
  const blocks = useMemo(() => {
    const r = rng(840000), out: { x: number; z: number; h: number; c: string }[] = [];
    for (let gx = -12; gx <= 12; gx++) for (let gz = -14; gz <= 2; gz++) {
      const d = Math.hypot(gx, gz + 4);
      const h = Math.max(0, Math.round(1 + Math.sin(gx * 0.6) * 1.4 + Math.cos(gz * 0.5) * 1.2 + d * 0.15 + r() * 0.8));
      out.push({ x: gx * 6, z: gz * 6 - 40, h, c: h <= 1 ? "#6fc36a" : h <= 3 ? "#58a956" : "#8a7a5a" });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = hills.current; if (!m) return; const o = new Object3D(), c = new Color();
    blocks.forEach((b, i) => { o.position.set(b.x, b.h * 1.5 - 1.5, b.z); o.scale.set(1, b.h * 3 + 1, 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(b.c)); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [blocks]);
  const towers = useMemo(() => { const r = rng(208); return Array.from({ length: 7 }, (_, i) => ({ x: -54 + i * 18 + r() * 4, z: -110 - r() * 30, h: 20 + r() * 40, c: i % 2 ? "#f7931a" : "#e8dcc4" })); }, []);
  useFrame(() => { const t = timeRef.current, g = sats.current; if (!g) return;
    g.children.forEach((c, i) => { c.position.y = 22 + Math.sin(t * 1.3 + i) * 2; c.rotation.y = t * 1.5 + i; }); });
  return (
    <group>
      {lit && <>
        <color attach="background" args={["#8fd3f4"]} />
        <hemisphereLight args={["#ffffff", "#e3c48a", 1.2]} />
        <directionalLight position={[30, 60, 20]} intensity={2} color="#fff1d6" />
      </>}
      <mesh position={[40, 70, -160]}><sphereGeometry args={[10, 16, 16]} /><meshBasicMaterial color="#fff4c2" /></mesh>
      <instancedMesh ref={hills} args={[undefined, undefined, blocks.length]}><boxGeometry args={[6, 1, 6]} /><meshStandardMaterial roughness={0.9} /></instancedMesh>
      <mesh position={[0, -1.2, -20]} rotation-x={-Math.PI / 2}><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#3fa7c9" roughness={0.25} metalness={0.1} /></mesh>
      {towers.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2, t.z]}><boxGeometry args={[8, t.h, 8]} /><meshStandardMaterial color={t.c} roughness={0.7} /></mesh>
      ))}
      <group ref={sats}>
        {[-24, -10, 6, 20, 32].map((x, i) => (
          <mesh key={i} position={[x, 22, -50 - i * 6]}><cylinderGeometry args={[2, 2, 0.5, 16]} /><meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.6} metalness={0.6} roughness={0.3} /></mesh>
        ))}
      </group>
    </group>
  );
}

const RIM_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const RIM_FRAG = `uniform float uTime; uniform float uOpen; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){
  vec2 p = vUv * 2.0 - 1.0; float a = atan(p.y, p.x); float r = length(p);
  float wob = 0.03 * sin(a * 7.0 + uTime * 3.0) + 0.02 * sin(a * 13.0 - uTime * 5.0);
  float edge = 0.86 + wob;
  float ring = exp(-pow((r - edge) * 18.0, 2.0));
  vec3 col = vec3(ring * 1.2, ring * 0.55 + ring * 0.4 * sin(a * 3.0 + uTime), ring * 0.2) ;
  col += vec3(0.25, 0.85, 1.0) * exp(-pow((r - edge - 0.04) * 22.0, 2.0)) * 0.9;
  col += vec3(1.0, 0.45, 0.85) * exp(-pow((r - edge + 0.05) * 26.0, 2.0)) * 0.6;
  float spark = step(0.985, h(floor(vec2(a * 40.0, uTime * 6.0)))) * smoothstep(1.0, edge, r) * step(edge, r);
  col += vec3(1.0, 0.8, 0.4) * spark;
  gl_FragColor = vec4(col * uOpen, (ring + spark) * uOpen);
}`;

/** Elliptical rift: a real hole in the brick wall onto the Oasis behind it (true parallax, no render target).
 * A brick plug shrinks away as it opens and a chromatic shader rim burns around the edge. */
function Portal({ timeRef, localRef, open, plugMap }: { timeRef: MutableRefObject<number>; localRef: MutableRefObject<number>; open: (local: number) => number; plugMap: CanvasTexture }) {
  const plug = useRef<Mesh>(null), rimG = useRef<Group>(null), rim = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpen: { value: 0 } }), []);
  useFrame(() => {
    const o = open(localRef.current);
    if (plug.current) { const s = Math.max(0.001, 1 - o); plug.current.scale.set(s, s, 1); plug.current.visible = o < 0.999; }
    if (rimG.current) rimG.current.visible = o > 0.001;
    if (rim.current) { rim.current.uniforms["uTime"]!.value = timeRef.current; rim.current.uniforms["uOpen"]!.value = o; }
  });
  return (
    <group position={[PORTAL.x, PORTAL.y, PORTAL.z]} scale={[1, 1.15, 1]}>
      <mesh ref={plug} position-z={0.02}><circleGeometry args={[PORTAL.r * 0.88, 48]} /><meshStandardMaterial map={plugMap} roughness={0.95} /></mesh>
      <group ref={rimG}>
        <mesh position-z={0.1}>
          <planeGeometry args={[PORTAL.r * 2.2, PORTAL.r * 2.2]} />
          <shaderMaterial ref={rim} vertexShader={RIM_VERT} fragmentShader={RIM_FRAG} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}

function holedWall() {
  const w = new Shape(); w.moveTo(-55, -21); w.lineTo(55, -21); w.lineTo(55, 21); w.lineTo(-55, 21); w.lineTo(-55, -21);
  const h = new Path(), rx = PORTAL.r * 0.88, ry = rx * 1.15, cy = PORTAL.y - 21; h.absellipse(PORTAL.x, cy, rx, ry, 0, Math.PI * 2, true, 0); w.holes.push(h);
  return w;
}

function brickTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const x = c.getContext("2d")!;
  const r = rng(1979); x.fillStyle = "#3a2a24"; x.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) for (let col = -1; col < 8; col++) {
    const off = row % 2 ? 16 : 0, v = 0.75 + r() * 0.35;
    x.fillStyle = `rgb(${Math.round(128 * v)},${Math.round(56 * v)},${Math.round(44 * v)})`;
    x.fillRect(col * 32 + off + 1, row * 16 + 1, 30, 14);
  }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; return t;
}

/** Original 1979-style northern rehearsal room (fictional): brick, pipes, posters, bare bulb, mic stand, amp.
 * `rift` opens the portal over the scene; everything reads the timeline, so scrubbing and export match. */
export function StudioSet({ timeRef, localRef, rift }: { timeRef: MutableRefObject<number>; localRef: MutableRefObject<number>; rift: boolean }) {
  const wall = useMemo(holedWall, []);
  const bricks = useMemo(() => { const back = brickTexture(); back.repeat.set(8 / 110, 3 / 42); const side = brickTexture(); side.repeat.set(6, 3); const plug = brickTexture(); plug.repeat.set(8 / 110, 3 / 42); return { back, side, plug }; }, []);
  const bulb = useRef<Group>(null), warm = useRef<PointLight>(null), bulbMesh = useRef<Mesh>(null);
  const open = (l: number) => (rift ? smooth(1.5, 5, l) : 0);
  useFrame(() => {
    const t = timeRef.current, o = open(localRef.current);
    if (bulb.current) bulb.current.rotation.z = Math.sin(t * 1.1) * 0.18;
    if (warm.current) warm.current.intensity = 3 + o * 25 * (0.9 + 0.1 * Math.sin(t * 9));
  });
  const posters = [["#d9d4c8", -34, 20], ["#1e1e1e", -20, 26], ["#c8402c", 30, 22], ["#efe9da", 40, 14]] as const;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[110, 70]} /><meshStandardMaterial color="#2e2a26" roughness={0.95} /></mesh>
      <mesh position={[0, 21, -30]}><shapeGeometry args={[wall]} /><meshStandardMaterial map={bricks.back} roughness={0.95} /></mesh>
      <group position={[0, -6, -45]}><OasisWorld timeRef={timeRef} lit={false} /></group>
      <directionalLight position={[30, 60, -120]} intensity={2} color="#fff1d6" target-position={[0, 0, -90]} />
      <mesh position={[-55, 21, 5]} rotation-y={Math.PI / 2}><planeGeometry args={[70, 42]} /><meshStandardMaterial map={bricks.side} roughness={0.95} side={DoubleSide} /></mesh>
      <mesh position={[55, 21, 5]} rotation-y={-Math.PI / 2}><planeGeometry args={[70, 42]} /><meshStandardMaterial map={bricks.side} roughness={0.95} side={DoubleSide} /></mesh>
      {[36, 39].map((y) => <mesh key={y} position={[0, y, -29]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.6, 0.6, 108, 8]} /><meshStandardMaterial color="#5c5f63" metalness={0.7} roughness={0.4} /></mesh>)}
      {posters.map(([c, x, y], i) => <mesh key={i} position={[x, y, -29.8]} rotation-z={(i - 1.5) * 0.04}><planeGeometry args={[7, 10]} /><meshStandardMaterial color={c} roughness={1} /></mesh>)}
      {/* amp + cabinet */}
      <mesh position={[26, 5, -20]}><boxGeometry args={[12, 10, 6]} /><meshStandardMaterial color="#171717" roughness={0.8} /></mesh>
      <mesh position={[26, 11, -20]}><boxGeometry args={[12, 2.5, 5]} /><meshStandardMaterial color="#c9c2b0" roughness={0.6} /></mesh>
      <mesh position={[-28, 3, -18]}><boxGeometry args={[10, 6, 8]} /><meshStandardMaterial color="#3d3a36" /></mesh>
      {/* mic stand */}
      <group position={[0, 0, 6]}>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[2, 2, 0.4, 12]} /><meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, 7, 0]}><cylinderGeometry args={[0.2, 0.2, 14, 8]} /><meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.2} /></mesh>
        <mesh position={[0, 14.4, 0.6]}><sphereGeometry args={[0.7, 10, 10]} /><meshStandardMaterial color="#555" metalness={0.8} roughness={0.4} /></mesh>
      </group>
      {/* swinging bare bulb */}
      <group ref={bulb} position={[0, 42, 0]}>
        <mesh position={[0, -6, 0]}><cylinderGeometry args={[0.08, 0.08, 12, 4]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh ref={bulbMesh} position={[0, -12.5, 0]}><sphereGeometry args={[0.9, 12, 12]} /><meshBasicMaterial color="#ffd38a" /></mesh>
        <pointLight position={[0, -13, 0]} color="#ffcf8a" intensity={900} distance={120} decay={2} />
      </group>
      <pointLight ref={warm} position={[0, PORTAL.y, PORTAL.z + 8]} color="#ffa04a" intensity={3} distance={45} decay={1} />
      <Portal timeRef={timeRef} localRef={localRef} open={open} plugMap={bricks.plug} />
    </group>
  );
}
