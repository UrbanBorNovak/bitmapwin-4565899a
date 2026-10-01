/**
 * Premium procedural Guardian bodies — AAA metaversal edition.
 * Built only from species and block-derived colours.
 *
 * Upgrades over the base version:
 *  - Physical materials (clearcoat, iridescence on EPIC/MYTHIC)
 *  - Shader-injected Fresnel rim light + travelling holo scan-band on EVERY part
 *  - Holo-plinth: machined base, counter-rotating glyph rings, rising scan ring, light beam
 *  - Animated rarity regalia (spinning crowns) and orbiting data shards
 *  - Pulsing reactor cores, spinning gyro rings, wing flap, additive eye halos
 */
import { createContext, memo, useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { morphFromDna } from "@/lib/creature-morph";
import { MorphBody } from "@/components/bitmon/MorphBody";
import { shapeOf, type GuardianRarity, type GuardianSpecies } from "@/lib/bitmon";

const noRaycast = () => {};
type Vec3 = [number, number, number];

/* ------------------------------------------------------------------ */
/*  Shared holo shader patch (rim light + scan band)                   */
/* ------------------------------------------------------------------ */

const U_TIME = { value: 0 };

type PatchShader = {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
};
type Patch = (shader: PatchShader) => void;

function makePatch(rim: THREE.Color, k: number): Patch {
  return (shader) => {
    shader.uniforms.uTime = U_TIME;
    shader.uniforms.uRim = { value: rim };
    shader.uniforms.uK = { value: k };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vHW;\nuniform float uTime;\nuniform vec3 uRim;\nuniform float uK;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float hRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += uRim * hRim * uK;
        float hBand = pow(max(0.0, 1.0 - abs(fract(vHW.y * 0.85 - uTime * 0.28) - 0.5) * 20.0), 2.0);
        totalEmissiveRadiance += uRim * hBand * uK * 0.55;`,
      );
  };
}

const cacheKey = () => "guardian-holo-v1";

const HoloCtx = createContext<{ patch?: Patch; iri: number }>({ iri: 0 });

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

function Part({
  position,
  scale,
  rotation,
  color,
  metalness = 0.22,
  roughness = 0.5,
  glow = 0,
  opacity = 1,
}: {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  color: string;
  metalness?: number;
  roughness?: number;
  glow?: number;
  opacity?: number;
}) {
  const { patch, iri } = useContext(HoloCtx);
  return (
    <mesh position={position} {...(rotation ? { rotation } : {})} castShadow receiveShadow raycast={noRaycast}>
      <boxGeometry args={scale} />
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow}
        metalness={metalness}
        roughness={roughness}
        clearcoat={metalness > 0.5 ? 0.55 : 0.18}
        clearcoatRoughness={0.28}
        iridescence={iri}
        flatShading
        transparent={opacity < 1}
        opacity={opacity}
        onBeforeCompile={patch as never}
        customProgramCacheKey={cacheKey}
      />
    </mesh>
  );
}

function Spike({
  position,
  rotation = [0, 0, 0],
  size,
  color,
  glow = 0,
  metalness = 0.6,
}: {
  position: Vec3;
  rotation?: Vec3;
  size: Vec3;
  color: string;
  glow?: number;
  metalness?: number;
}) {
  const { patch } = useContext(HoloCtx);
  return (
    <mesh position={position} rotation={rotation} castShadow raycast={noRaycast}>
      <coneGeometry args={[size[0], size[1], Math.max(4, Math.round(size[2]))]} />
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow}
        metalness={metalness}
        roughness={0.28}
        clearcoat={0.5}
        flatShading
        onBeforeCompile={patch as never}
        customProgramCacheKey={cacheKey}
      />
    </mesh>
  );
}

function Gem({ position, scale, color, glow }: { position: Vec3; scale: number; color: string; glow: number }) {
  return (
    <mesh position={position} castShadow raycast={noRaycast}>
      <octahedronGeometry args={[scale, 0]} />
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow + 0.7}
        metalness={0.8}
        roughness={0.12}
        clearcoat={1}
        flatShading
      />
    </mesh>
  );
}

/** Soft additive glow ball (eye halos, core bloom). */
function Halo({
  position,
  radius,
  color,
  opacity = 0.32,
}: {
  position: Vec3;
  radius: number;
  color: string;
  opacity?: number;
}) {
  return (
    <mesh position={position} raycast={noRaycast}>
      <sphereGeometry args={[radius, 10, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Continuous rotation around one axis. */
function Spin({
  speed = 1,
  axis = "y",
  position,
  rotation,
  children,
}: {
  speed?: number;
  axis?: "x" | "y" | "z";
  position?: Vec3;
  rotation?: Vec3;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation[axis] += Math.min(dt, 0.05) * speed;
  });
  return (
    <group {...(position ? { position } : {})} {...(rotation ? { rotation } : {})} raycast={noRaycast}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

/** Wing flap wrapper. */
function Flap({ side, amp, children }: { side: number; amp: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = side * (0.08 + Math.sin(clock.elapsedTime * 1.7) * amp);
  });
  return (
    <group ref={ref} raycast={noRaycast}>
      {children}
    </group>
  );
}

/** Pulsing energy reactor: core gem, wire cage, gyro rings, bloom. */
function Reactor({
  position,
  u,
  accent,
  gleam,
  glow,
  size = 1,
}: {
  position: Vec3;
  u: number;
  accent: string;
  gleam: string;
  glow: number;
  size?: number;
}) {
  const s = size * u;
  return (
    <group position={position} raycast={noRaycast}>
      <Gem position={[0, 0, 0]} scale={0.062 * s} color={gleam} glow={glow + 0.6} />
      <mesh raycast={noRaycast}>
        <icosahedronGeometry args={[0.105 * s, 0]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={0.8} />
      </mesh>
      <Spin speed={1.8} rotation={[Math.PI / 2.4, 0, 0]}>
        <mesh raycast={noRaycast}>
          <torusGeometry args={[0.14 * s, 0.007 * s, 4, 24]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      </Spin>
      <Spin speed={-1.3} axis="x" rotation={[0, 0.5, Math.PI / 3]}>
        <mesh raycast={noRaycast}>
          <torusGeometry args={[0.18 * s, 0.005 * s, 4, 28]} />
          <meshBasicMaterial color={gleam} transparent opacity={0.8} />
        </mesh>
      </Spin>
      <Halo position={[0, 0, 0]} radius={0.2 * s} color={accent} opacity={0.2} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Rarity regalia — spinning holographic crown                        */
/* ------------------------------------------------------------------ */

function RarityRegalia({
  rarity,
  accent,
  u,
  glow,
}: {
  rarity: GuardianRarity;
  accent: string;
  u: number;
  glow: number;
}) {
  if (rarity === "COMMON") return null;
  const points = rarity === "MYTHIC" ? 10 : rarity === "EPIC" ? 7 : 5;
  const haloR = rarity === "MYTHIC" ? 0.84 : rarity === "EPIC" ? 0.74 : 0.66;
  return (
    <group raycast={noRaycast}>
      <Spin speed={rarity === "MYTHIC" ? 0.7 : 0.45}>
        {Array.from({ length: points }, (_, i) => {
          const angle = (i / points) * Math.PI * 2;
          const radius = haloR * u;
          const tall = rarity === "MYTHIC" ? 0.3 : rarity === "EPIC" ? 0.21 : 0.14;
          return (
            <group key={i} position={[Math.sin(angle) * radius, 1.22 * u, Math.cos(angle) * radius]} rotation-y={angle}>
              <Part
                position={[0, 0, 0]}
                scale={[0.048 * u, tall * u, 0.048 * u]}
                rotation={[0, 0, i % 2 ? 0.42 : -0.42]}
                color={accent}
                metalness={0.82}
                roughness={0.14}
                glow={glow * 0.6}
              />
              {rarity === "MYTHIC" || rarity === "EPIC" ? (
                <Gem position={[0, tall * 0.55 * u, 0]} scale={0.03 * u} color={accent} glow={glow} />
              ) : null}
            </group>
          );
        })}
      </Spin>
      {rarity === "MYTHIC" ? (
        <>
          <Spin speed={-0.5} position={[0, 1.26 * u, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh raycast={noRaycast}>
              <torusGeometry args={[0.9 * u, 0.016 * u, 4, 40]} />
              <meshBasicMaterial
                color={accent}
                transparent
                opacity={0.8}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </Spin>
          <Spin speed={0.9} axis="z" position={[0, 1.34 * u, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh raycast={noRaycast}>
              <torusGeometry args={[0.62 * u, 0.012 * u, 4, 32]} />
              <meshBasicMaterial
                color={accent}
                transparent
                opacity={0.6}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </Spin>
        </>
      ) : rarity === "EPIC" ? (
        <mesh position={[0, 1.24 * u, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
          <torusGeometry args={[0.78 * u, 0.014 * u, 4, 28]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Holo-plinth: base, glyph rings, scan ring, light beam, data shards */
/* ------------------------------------------------------------------ */

const BEAM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uOp; uniform float uT;
  varying vec2 vUv;
  void main() {
    float fall = pow(1.0 - vUv.y, 1.7);
    float flow = 0.72 + 0.28 * sin(vUv.y * 28.0 - uT * 2.2);
    float a = fall * flow * uOp;
    gl_FragColor = vec4(uColor, a);
  }
`;

function HoloPlinth({ rarity, accent, u, glow }: { rarity: GuardianRarity; accent: string; u: number; glow: number }) {
  const scan = useRef<THREE.Mesh>(null);
  const scanMat = useRef<THREE.MeshBasicMaterial>(null);
  const motes = useRef<THREE.Group>(null);
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(accent) }, uOp: { value: 0 }, uT: { value: 0 } },
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [accent],
  );
  const beamOp = rarity === "MYTHIC" ? 0.34 : rarity === "EPIC" ? 0.24 : rarity === "RARE" ? 0.16 : 0.07;
  const moteCount = rarity === "MYTHIC" ? 14 : rarity === "EPIC" ? 9 : rarity === "RARE" ? 5 : 0;
  const R = (rarity === "MYTHIC" ? 1.3 : 1.08) * u;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    beamMat.uniforms.uT!.value = t;
    beamMat.uniforms.uOp!.value = beamOp * (0.85 + Math.sin(t * 1.9) * 0.15);
    if (scan.current && scanMat.current) {
      const p = (t * 0.32) % 1;
      scan.current.position.y = (0.05 + p * 2.15) * u;
      const s = 1 - p * 0.28;
      scan.current.scale.set(s, s, 1);
      scanMat.current.opacity = Math.sin(p * Math.PI) * 0.7;
    }
    if (motes.current) {
      motes.current.rotation.y = t * 0.42;
      motes.current.children.forEach((child, i) => {
        child.position.y = (0.3 + Math.sin(t * 1.6 + i * 0.7) * 0.34 + (i % 5) * 0.06) * u;
        child.rotation.x = t * (1 + (i % 3) * 0.4);
        child.rotation.z = t * 0.8;
        child.scale.setScalar(0.62 + (Math.sin(t * 3.1 + i * 1.4) + 1) * 0.38);
      });
    }
  });

  return (
    <group raycast={noRaycast}>
      {/* machined disc */}
      <mesh position={[0, -0.02 * u, 0]} receiveShadow raycast={noRaycast}>
        <cylinderGeometry args={[R, R * 1.06, 0.07 * u, 6]} />
        <meshPhysicalMaterial color="#0b0e16" metalness={0.92} roughness={0.22} clearcoat={0.8} flatShading />
      </mesh>
      <mesh position={[0, 0.02 * u, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <circleGeometry args={[R * 0.94, 6]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.07 + glow * 0.04}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* glowing hex edge */}
      <mesh position={[0, 0.026 * u, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <ringGeometry args={[R * 0.93, R * 0.99, 6]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* counter-rotating glyph arcs */}
      <Spin speed={0.55} position={[0, 0.034 * u, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-z={(i / 3) * Math.PI * 2} raycast={noRaycast}>
            <ringGeometry args={[R * 0.7, R * 0.76, 24, 1, 0, Math.PI * 0.46]} />
            <meshBasicMaterial
              color={accent}
              transparent
              opacity={0.75}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </Spin>
      <Spin speed={-0.9} axis="z" position={[0, 0.038 * u, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation-z={(i / 4) * Math.PI * 2} raycast={noRaycast}>
            <ringGeometry args={[R * 0.5, R * 0.535, 16, 1, 0, Math.PI * 0.28]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </Spin>

      {/* rising scan ring */}
      <mesh ref={scan} rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <ringGeometry args={[0.8 * u, 0.84 * u, 48]} />
        <meshBasicMaterial
          ref={scanMat}
          color={accent}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* light beam */}
      <mesh position={[0, 1.35 * u, 0]} raycast={noRaycast} material={beamMat}>
        <cylinderGeometry args={[0.62 * u, 0.98 * u, 2.7 * u, 24, 1, true]} />
      </mesh>

      {/* orbiting data shards */}
      <group ref={motes}>
        {Array.from({ length: moteCount }, (_, i) => {
          const angle = (i / Math.max(1, moteCount)) * Math.PI * 2;
          const radius = (0.58 + (i % 4) * 0.16) * u;
          return (
            <mesh key={i} position={[Math.sin(angle) * radius, 0.48 * u, Math.cos(angle) * radius]} raycast={noRaycast}>
              <tetrahedronGeometry args={[0.034 * u, 0]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={glow + 1.3}
                transparent
                opacity={0.92}
                flatShading
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Species bodies                                                     */
/* ------------------------------------------------------------------ */

const SpeciesBody = memo(function SpeciesBody({
  species,
  rarity,
  body,
  accent,
  unit = 1,
}: {
  species: GuardianSpecies;
  rarity: GuardianRarity;
  body: string;
  accent: string;
  unit?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const motion = useRef<THREE.Group>(null);
  const shape = shapeOf(species);
  const u = unit;
  const glow = rarity === "MYTHIC" ? 1.45 : rarity === "EPIC" ? 0.85 : rarity === "RARE" ? 0.42 : 0.16;
  const tones = useMemo(() => {
    const base = new THREE.Color(body);
    const acc = new THREE.Color(accent);
    return {
      shadow: `#${base.clone().multiplyScalar(0.42).getHexString()}`,
      deep: `#${base.clone().multiplyScalar(0.28).getHexString()}`,
      mid: `#${base.clone().lerp(acc, 0.18).getHexString()}`,
      light: `#${base.clone().lerp(new THREE.Color("#ffffff"), 0.22).getHexString()}`,
      gleam: `#${acc.clone().lerp(new THREE.Color("#ffffff"), 0.28).getHexString()}`,
    };
  }, [body, accent]);

  const holo = useMemo(() => {
    const k = rarity === "MYTHIC" ? 1.15 : rarity === "EPIC" ? 0.85 : rarity === "RARE" ? 0.6 : 0.38;
    const rim = new THREE.Color(accent).lerp(new THREE.Color("#ffffff"), 0.18);
    return { patch: makePatch(rim, k), iri: rarity === "MYTHIC" ? 0.75 : rarity === "EPIC" ? 0.45 : 0 };
  }, [accent, rarity]);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    U_TIME.value = clock.elapsedTime;
    const t = clock.elapsedTime + species.length * 0.37;
    if (root.current) {
      const target = 1 + Math.sin(t * 1.7) * 0.012;
      root.current.scale.y = THREE.MathUtils.damp(root.current.scale.y, target, 7, dt);
    }
    if (motion.current) {
      motion.current.rotation.y = Math.sin(t * 0.72) * 0.055;
      motion.current.rotation.z = Math.sin(t * 0.9) * 0.008;
      motion.current.position.y = (shape === "wisp" ? Math.sin(t * 1.8) * 0.08 : Math.sin(t * 1.4) * 0.018) * u;
      const pulse = 0.72 + (Math.sin(t * 2.1) + 1) * 0.3;
      motion.current.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (!mat || !("emissiveIntensity" in mat)) return;
        if (mesh.userData.glowBase === undefined) {
          if (mat.emissiveIntensity <= 0.001) return;
          mesh.userData.glowBase = mat.emissiveIntensity;
        }
        mat.emissiveIntensity = (mesh.userData.glowBase as number) * pulse;
      });
    }
  });

  const eye = (position: Vec3, scale: Vec3 = [0.055 * u, 0.055 * u, 0.035 * u]) => (
    <group>
      <Part position={position} scale={scale} color={accent} metalness={0.28} roughness={0.16} glow={glow + 1.0} />
      <Part
        position={[position[0], position[1], position[2] + scale[2] * 0.35]}
        scale={[scale[0] * 0.38, scale[1] * 0.38, scale[2] * 0.4]}
        color={tones.gleam}
        metalness={0.2}
        roughness={0.12}
        glow={glow + 1.3}
      />
      <Halo
        position={[position[0], position[1], position[2] + scale[2] * 0.6]}
        radius={Math.max(scale[0], scale[1]) * 1.1}
        color={accent}
        opacity={0.3}
      />
    </group>
  );
  const rune = (position: Vec3, scale: Vec3, rotation?: Vec3) => (
    <Part
      position={position}
      scale={scale}
      {...(rotation ? { rotation } : {})}
      color={accent}
      metalness={0.62}
      roughness={0.18}
      glow={glow * 0.85}
    />
  );
  const vein = (position: Vec3, scale: Vec3, rotation?: Vec3) => (
    <Part
      position={position}
      scale={scale}
      {...(rotation ? { rotation } : {})}
      color={tones.gleam}
      metalness={0.3}
      roughness={0.2}
      glow={glow * 0.9 + 0.35}
    />
  );

  let creature: React.ReactNode;

  if (shape === "golem") {
    const obsidian = species === "OBSIDIAN BEHEMOTH";
    creature = (
      <group>
        <Part
          position={[0, 1.02 * u, 0]}
          scale={[0.96 * u, 0.86 * u, 0.66 * u]}
          color={body}
          metalness={obsidian ? 0.52 : 0.34}
        />
        <Part position={[0, 1.02 * u, 0]} scale={[1.08 * u, 0.18 * u, 0.74 * u]} color={tones.shadow} metalness={0.6} />
        <Part
          position={[0, 1.22 * u, -0.36 * u]}
          scale={[0.68 * u, 0.6 * u, 0.14 * u]}
          color={tones.deep}
          metalness={0.64}
          roughness={0.28}
        />
        {/* back power conduit */}
        {vein([0, 1.2 * u, -0.44 * u], [0.06 * u, 0.5 * u, 0.03 * u])}
        {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
          <Part
            key={`spine-${i}`}
            position={[x * 0.16 * u, 1.46 * u, -0.4 * u]}
            scale={[0.14 * u, 0.12 * u, 0.18 * u]}
            rotation={[0.22, 0, x * 0.08]}
            color={i === 1 || i === 2 ? accent : tones.mid}
            metalness={0.74}
            glow={i === 1 || i === 2 ? glow * 0.5 : 0}
          />
        ))}
        <Part
          position={[0, 1.14 * u, 0.34 * u]}
          scale={[0.66 * u, 0.48 * u, 0.06 * u]}
          color={tones.shadow}
          metalness={0.78}
          roughness={0.2}
        />
        {[-1, 1].map((s) => (
          <Part
            key={`pect-${s}`}
            position={[s * 0.2 * u, 1.2 * u, 0.38 * u]}
            scale={[0.26 * u, 0.34 * u, 0.05 * u]}
            rotation={[0, 0, s * 0.1]}
            color={tones.light}
            metalness={0.56}
          />
        ))}
        {/* torso light-veins feeding the reactor */}
        {[-1, 1].map((s) => (
          <group key={`veins-${s}`}>
            {vein([s * 0.34 * u, 1.1 * u, 0.4 * u], [0.022 * u, 0.4 * u, 0.026 * u], [0, 0, s * 0.12])}
            {vein([s * 0.18 * u, 0.94 * u, 0.4 * u], [0.2 * u, 0.02 * u, 0.026 * u])}
          </group>
        ))}
        {rune([0, 1.08 * u, 0.41 * u], [0.2 * u, 0.2 * u, 0.03 * u], [0, 0, Math.PI / 4])}
        <Reactor position={[0, 1.08 * u, 0.5 * u]} u={u} accent={accent} gleam={tones.gleam} glow={glow} />
        {[-1, 1].map((s) => (
          <group key={`vent-${s}`}>
            <Part
              position={[s * 0.32 * u, 0.9 * u, 0.4 * u]}
              scale={[0.12 * u, 0.04 * u, 0.03 * u]}
              color={accent}
              glow={glow * 0.6}
            />
            <Part
              position={[s * 0.32 * u, 0.82 * u, 0.4 * u]}
              scale={[0.09 * u, 0.025 * u, 0.025 * u]}
              color={tones.gleam}
              glow={glow * 0.4}
            />
          </group>
        ))}

        <Part position={[0, 1.72 * u, 0.02 * u]} scale={[0.6 * u, 0.48 * u, 0.52 * u]} color={body} />
        <Part
          position={[0, 1.94 * u, -0.02 * u]}
          scale={[0.48 * u, 0.14 * u, 0.4 * u]}
          color={tones.light}
          metalness={0.7}
        />
        <Part
          position={[0, 1.6 * u, 0.3 * u]}
          scale={[0.36 * u, 0.1 * u, 0.09 * u]}
          color={tones.deep}
          metalness={0.54}
        />
        <Part position={[0, 1.48 * u, 0.22 * u]} scale={[0.22 * u, 0.08 * u, 0.16 * u]} color={tones.shadow} />
        {/* visor slit */}
        {vein([0, 1.74 * u, 0.3 * u], [0.34 * u, 0.025 * u, 0.02 * u])}
        {[-1, 1].map((s) => (
          <group key={`face-${s}`}>
            {eye([s * 0.14 * u, 1.74 * u, 0.29 * u], [0.1 * u, 0.058 * u, 0.038 * u])}
            <Part
              position={[s * 0.24 * u, 1.56 * u, 0.26 * u]}
              scale={[0.14 * u, 0.2 * u, 0.09 * u]}
              rotation={[0, 0, s * 0.14]}
              color={tones.mid}
              metalness={0.6}
            />
            <Part
              position={[s * 0.28 * u, 1.78 * u, 0.08 * u]}
              scale={[0.08 * u, 0.22 * u, 0.22 * u]}
              rotation={[0, 0, s * 0.18]}
              color={tones.shadow}
              metalness={0.54}
            />
          </group>
        ))}
        {obsidian ? (
          [-1.5, -0.5, 0.5, 1.5].map((x, i) => (
            <Spike
              key={`crown-${i}`}
              position={[x * 0.12 * u, (2.02 + (Math.abs(x) < 0.6 ? 0.1 : 0)) * u, -0.04 * u]}
              rotation={[0, 0, -x * 0.12]}
              size={[0.07 * u, (Math.abs(x) < 0.6 ? 0.38 : 0.24) * u, 5]}
              color={accent}
              glow={glow * 0.5}
            />
          ))
        ) : (
          <group>
            <Part
              position={[0, 2.04 * u, 0]}
              scale={[0.18 * u, 0.16 * u, 0.36 * u]}
              color={accent}
              metalness={0.8}
              glow={glow * 0.4}
            />
            <Gem position={[0, 2.16 * u, 0]} scale={0.055 * u} color={accent} glow={glow} />
          </group>
        )}

        {[-1, 1].map((s) => (
          <group key={`arm-${s}`}>
            <Part
              position={[s * 0.7 * u, 1.46 * u, 0]}
              scale={[0.44 * u, 0.38 * u, 0.56 * u]}
              rotation={[0, 0, s * 0.1]}
              color={body}
            />
            <Part
              position={[s * 0.74 * u, 1.62 * u, 0]}
              scale={[0.5 * u, 0.12 * u, 0.6 * u]}
              rotation={[0, 0, s * 0.12]}
              color={accent}
              metalness={0.78}
              roughness={0.2}
              glow={glow * 0.2}
            />
            <Part
              position={[s * 0.78 * u, 1.46 * u, -0.18 * u]}
              scale={[0.16 * u, 0.28 * u, 0.12 * u]}
              rotation={[0.2, 0, s * 0.08]}
              color={tones.mid}
            />
            {obsidian ? (
              <Spike
                position={[s * 0.74 * u, 1.86 * u, -0.06 * u]}
                rotation={[0, 0, -s * 0.2]}
                size={[0.09 * u, 0.38 * u, 5]}
                color={accent}
                glow={glow * 0.4}
              />
            ) : null}
            <Part
              position={[s * 0.68 * u, 1.05 * u, 0]}
              scale={[0.24 * u, 0.48 * u, 0.28 * u]}
              color={tones.shadow}
              metalness={0.52}
            />
            <Part
              position={[s * 0.68 * u, 1.08 * u, 0.16 * u]}
              scale={[0.1 * u, 0.32 * u, 0.06 * u]}
              color={accent}
              glow={glow * 0.28}
            />
            <Part
              position={[s * 0.68 * u, 0.82 * u, 0.02 * u]}
              scale={[0.3 * u, 0.16 * u, 0.34 * u]}
              color={accent}
              metalness={0.78}
              glow={glow * 0.3}
            />
            <Part position={[s * 0.68 * u, 0.56 * u, 0.12 * u]} scale={[0.4 * u, 0.36 * u, 0.44 * u]} color={body} />
            {[-1.2, 0, 1.2].map((f) => (
              <Part
                key={`finger-${f}`}
                position={[(s * 0.68 + f * 0.09) * u, 0.4 * u, 0.34 * u]}
                scale={[0.07 * u, 0.16 * u, 0.2 * u]}
                color={tones.light}
                metalness={0.46}
              />
            ))}
            <Spike
              position={[s * 0.68 * u, 0.38 * u, 0.48 * u]}
              rotation={[Math.PI / 2, 0, 0]}
              size={[0.035 * u, 0.16 * u, 4]}
              color={accent}
              glow={glow * 0.2}
            />
          </group>
        ))}

        {[-1, 1].map((s) => (
          <group key={`leg-${s}`}>
            <Part position={[s * 0.27 * u, 0.56 * u, 0]} scale={[0.33 * u, 0.52 * u, 0.36 * u]} color={body} />
            <Part
              position={[s * 0.27 * u, 0.44 * u, 0.2 * u]}
              scale={[0.36 * u, 0.18 * u, 0.08 * u]}
              color={accent}
              metalness={0.74}
              glow={glow * 0.15}
            />
            <Part
              position={[s * 0.27 * u, 0.2 * u, 0.02 * u]}
              scale={[0.28 * u, 0.28 * u, 0.32 * u]}
              color={tones.shadow}
            />
            <Part position={[s * 0.27 * u, 0.07 * u, 0.16 * u]} scale={[0.46 * u, 0.14 * u, 0.6 * u]} color={body} />
            {[-1, 0, 1].map((toe) => (
              <group key={`toe-${toe}`}>
                <Part
                  position={[(s * 0.27 + toe * 0.11) * u, 0.075 * u, 0.48 * u]}
                  scale={[0.08 * u, 0.08 * u, 0.2 * u]}
                  color={accent}
                  metalness={0.76}
                  glow={glow * 0.2}
                />
                <Spike
                  position={[(s * 0.27 + toe * 0.11) * u, 0.06 * u, 0.6 * u]}
                  rotation={[Math.PI / 2, 0, 0]}
                  size={[0.022 * u, 0.1 * u, 4]}
                  color={tones.gleam}
                />
              </group>
            ))}
          </group>
        ))}
      </group>
    );
  } else if (shape === "wisp") {
    creature = (
      <group>
        <mesh position={[0, 1.22 * u, 0]} castShadow raycast={noRaycast}>
          <icosahedronGeometry args={[0.5 * u, 1]} />
          <meshPhysicalMaterial
            color={body}
            emissive={accent}
            emissiveIntensity={0.3 + glow * 0.55}
            roughness={0.1}
            metalness={0.18}
            transparent
            opacity={0.78}
            clearcoat={1}
            clearcoatRoughness={0.08}
            iridescence={0.6}
            onBeforeCompile={holo.patch as never}
            customProgramCacheKey={cacheKey}
          />
        </mesh>
        <mesh position={[0, 1.22 * u, 0]} raycast={noRaycast}>
          <icosahedronGeometry args={[0.32 * u, 0]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.7 + glow}
            transparent
            opacity={0.6}
            flatShading
          />
        </mesh>
        <Halo position={[0, 1.22 * u, 0]} radius={0.7 * u} color={accent} opacity={0.1} />
        <Part
          position={[0, 1.54 * u, -0.08 * u]}
          scale={[0.72 * u, 0.2 * u, 0.56 * u]}
          color={tones.deep}
          metalness={0.52}
        />
        {[-1, 1].map((s) => (
          <Part
            key={`hood-${s}`}
            position={[s * 0.3 * u, 1.3 * u, 0.04 * u]}
            scale={[0.22 * u, 0.54 * u, 0.52 * u]}
            rotation={[0, 0, s * 0.2]}
            color={tones.shadow}
            metalness={0.44}
          />
        ))}
        <Part
          position={[0, 1.06 * u, 0.38 * u]}
          scale={[0.42 * u, 0.38 * u, 0.08 * u]}
          color={tones.shadow}
          metalness={0.56}
        />
        {[-1, 1].map((s) => eye([s * 0.11 * u, 1.22 * u, 0.44 * u], [0.08 * u, 0.048 * u, 0.028 * u]))}
        {rune([0, 1.02 * u, 0.44 * u], [0.06 * u, 0.16 * u, 0.028 * u])}
        {/* gyroscopic ring set */}
        <Spin speed={1.1} position={[0, 1.22 * u, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh raycast={noRaycast}>
            <torusGeometry args={[0.58 * u, 0.022 * u, 4, 28]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={glow + 0.2} metalness={0.7} />
          </mesh>
        </Spin>
        <Spin speed={-0.8} axis="x" position={[0, 1.22 * u, 0]} rotation={[0, Math.PI / 4, Math.PI / 3]}>
          <mesh raycast={noRaycast}>
            <torusGeometry args={[0.74 * u, 0.016 * u, 4, 30]} />
            <meshBasicMaterial
              color={accent}
              transparent
              opacity={0.75}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </Spin>
        <Spin speed={0.6} axis="y" position={[0, 1.22 * u, 0]} rotation={[Math.PI / 5, -Math.PI / 6, 0]}>
          <mesh raycast={noRaycast}>
            <torusGeometry args={[0.86 * u, 0.012 * u, 4, 32]} />
            <meshBasicMaterial
              color={tones.gleam}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </Spin>
        {[-1, 1].map((s) => (
          <group key={`hand-${s}`} position={[s * 0.76 * u, 0.94 * u, 0.1 * u]} rotation-z={-s * 0.28}>
            <Part position={[0, 0, 0]} scale={[0.26 * u, 0.22 * u, 0.3 * u]} color={tones.mid} metalness={0.6} />
            <Part
              position={[0, 0.08 * u, 0]}
              scale={[0.3 * u, 0.06 * u, 0.34 * u]}
              color={accent}
              metalness={0.74}
              glow={glow * 0.3}
            />
            {[-1, 0, 1].map((f) => (
              <Part
                key={f}
                position={[f * 0.075 * u, -0.14 * u, 0.13 * u]}
                scale={[0.05 * u, 0.2 * u, 0.06 * u]}
                color={accent}
                glow={glow * 0.5}
              />
            ))}
          </group>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const a = i * 0.9;
          return (
            <Spike
              key={`trail-${i}`}
              position={[
                Math.sin(a) * (0.16 + (i % 3) * 0.12) * u,
                (0.5 - (i % 4) * 0.07) * u,
                Math.cos(a) * (0.16 + (i % 3) * 0.12) * u,
              ]}
              rotation={[Math.PI, 0, a]}
              size={[0.085 * u, (0.52 - (i % 3) * 0.1) * u, 5]}
              color={i % 2 ? accent : body}
              glow={i % 2 ? glow * 0.45 : 0}
            />
          );
        })}
        <Spin speed={0.5}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh
                key={`shard-${i}`}
                position={[Math.sin(a) * 0.78 * u, (1.12 + Math.sin(a * 2) * 0.24) * u, Math.cos(a) * 0.78 * u]}
                rotation={[a, a * 0.7, 0]}
                raycast={noRaycast}
              >
                <octahedronGeometry args={[0.07 * u, 0]} />
                <meshPhysicalMaterial
                  color={accent}
                  emissive={accent}
                  emissiveIntensity={glow * 0.95}
                  metalness={0.7}
                  roughness={0.14}
                  clearcoat={1}
                  flatShading
                />
              </mesh>
            );
          })}
        </Spin>
      </group>
    );
  } else if (shape === "bird") {
    creature = (
      <group>
        <Part position={[0, 0.82 * u, -0.1 * u]} scale={[0.54 * u, 0.56 * u, 1.12 * u]} color={body} />
        <Part position={[0, 0.62 * u, -0.08 * u]} scale={[0.46 * u, 0.22 * u, 0.86 * u]} color={tones.shadow} />
        {/* dorsal light strip */}
        {vein([0, 1.11 * u, -0.1 * u], [0.04 * u, 0.02 * u, 0.9 * u])}
        {(
          [
            [-0.2, 0.14],
            [-0.07, 0.08],
            [0.07, 0.08],
            [0.2, 0.14],
          ] as const
        ).map(([x, y], i) => (
          <Part
            key={`breast-${i}`}
            position={[x * u, (0.94 + y) * u, 0.48 * u]}
            scale={[0.16 * u, 0.28 * u, 0.1 * u]}
            rotation={[0.16, 0, x * 0.45]}
            color={i === 1 || i === 2 ? tones.light : tones.mid}
          />
        ))}
        <Reactor position={[0, 1.0 * u, 0.58 * u]} u={u} accent={accent} gleam={tones.gleam} glow={glow} size={0.55} />
        <Part position={[0, 1.3 * u, 0.5 * u]} scale={[0.44 * u, 0.44 * u, 0.44 * u]} color={body} />
        <Part position={[0, 1.24 * u, 0.8 * u]} scale={[0.3 * u, 0.22 * u, 0.3 * u]} color={tones.light} />
        <Spike
          position={[0, 1.2 * u, 1.02 * u]}
          rotation={[Math.PI / 2, 0, 0]}
          size={[0.11 * u, 0.38 * u, 5]}
          color={accent}
          glow={glow * 0.35}
        />
        <Part position={[0, 1.14 * u, 0.92 * u]} scale={[0.16 * u, 0.06 * u, 0.12 * u]} color={tones.deep} />
        {[-1, 1].map((s) => (
          <group key={`bird-face-${s}`}>
            {eye([s * 0.125 * u, 1.38 * u, 0.72 * u])}
            <Part
              position={[s * 0.22 * u, 1.46 * u, 0.4 * u]}
              scale={[0.13 * u, 0.22 * u, 0.18 * u]}
              rotation={[0, 0, s * 0.22]}
              color={accent}
              metalness={0.66}
              glow={glow * 0.15}
            />
          </group>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <Spike
            key={`crest-${i}`}
            position={[(i - 2) * 0.09 * u, (1.58 - Math.abs(i - 2) * 0.035) * u, 0.4 * u]}
            rotation={[-0.28, 0, (i - 2) * -0.07]}
            size={[0.042 * u, (0.28 - Math.abs(i - 2) * 0.03) * u, 4]}
            color={i % 2 ? accent : tones.light}
            glow={i % 2 ? glow * 0.4 : 0}
          />
        ))}
        {[-1, 1].map((s) => (
          <Flap key={`wing-${s}`} side={s} amp={rarity === "COMMON" ? 0.03 : 0.06}>
            <Part
              position={[s * 0.56 * u, 1.04 * u, -0.04 * u]}
              scale={[0.66 * u, 0.12 * u, 0.74 * u]}
              rotation={[0, s * 0.08, s * 0.26]}
              color={accent}
              metalness={0.58}
              glow={glow * 0.28}
            />
            {[0, 1, 2, 3, 4, 5].map((f) => (
              <Part
                key={`primary-${f}`}
                position={[s * (0.74 + f * 0.175) * u, (0.98 - f * 0.055) * u, (-0.12 - f * 0.09) * u]}
                scale={[(0.42 - f * 0.03) * u, 0.042 * u, 0.15 * u]}
                rotation={[0, s * (0.1 + f * 0.03), s * (0.32 + f * 0.04)]}
                color={f % 2 ? tones.light : body}
                metalness={0.3}
                glow={f === 5 ? glow * 0.7 : 0}
              />
            ))}
            {[0, 1, 2, 3].map((f) => (
              <Part
                key={`covert-${f}`}
                position={[s * (0.48 + f * 0.16) * u, (1.13 - f * 0.02) * u, (0.18 - f * 0.12) * u]}
                scale={[0.32 * u, 0.06 * u, 0.18 * u]}
                rotation={[0, s * 0.08, s * (0.18 + f * 0.045)]}
                color={f === 1 ? accent : tones.mid}
                metalness={0.48}
                glow={f === 1 ? glow * 0.25 : 0}
              />
            ))}
          </Flap>
        ))}
        {[-1, 1].map((s) => (
          <group key={`talon-${s}`}>
            <Part
              position={[s * 0.18 * u, 0.36 * u, 0.36 * u]}
              scale={[0.12 * u, 0.56 * u, 0.12 * u]}
              color={tones.light}
            />
            <Part position={[s * 0.18 * u, 0.08 * u, 0.5 * u]} scale={[0.22 * u, 0.1 * u, 0.32 * u]} color={body} />
            {[-1, 0, 1].map((c) => (
              <Spike
                key={c}
                position={[(s * 0.18 + c * 0.06) * u, 0.055 * u, 0.72 * u]}
                rotation={[Math.PI / 2, 0, 0]}
                size={[0.024 * u, 0.16 * u, 4]}
                color={accent}
              />
            ))}
          </group>
        ))}
        {[-1, 1].map((s) => (
          <group key={`hind-${s}`}>
            <Part
              position={[s * 0.16 * u, 0.38 * u, -0.42 * u]}
              scale={[0.14 * u, 0.42 * u, 0.16 * u]}
              color={tones.mid}
            />
            <Part position={[s * 0.16 * u, 0.1 * u, -0.36 * u]} scale={[0.2 * u, 0.1 * u, 0.26 * u]} color={body} />
          </group>
        ))}
        {[-1.5, -0.5, 0.5, 1.5].map((f, i) => (
          <Part
            key={`tail-${i}`}
            position={[f * 0.09 * u, 0.74 * u, -0.88 * u]}
            scale={[0.11 * u, 0.065 * u, (0.7 - Math.abs(f) * 0.08) * u]}
            rotation={[-0.32, f * -0.1, 0]}
            color={i === 1 || i === 2 ? accent : tones.light}
            metalness={i === 1 || i === 2 ? 0.56 : 0.2}
            glow={i === 1 || i === 2 ? glow * 0.35 : 0}
          />
        ))}
      </group>
    );
  } else if (shape === "wyrm") {
    const cyber = species === "CYBER WYRM";
    creature = (
      <group>
        {[-0.84, -0.56, -0.28, 0, 0.28, 0.56, 0.84].map((z, i) => (
          <group key={`segment-${i}`}>
            <Part
              position={[0, (0.64 + (3 - Math.abs(i - 3)) * 0.04) * u, z * u]}
              scale={[(0.56 - Math.abs(i - 3) * 0.035) * u, 0.44 * u, 0.34 * u]}
              color={i % 2 ? tones.mid : body}
            />
            <Part
              position={[0, 0.88 * u, z * u]}
              scale={[(0.4 - Math.abs(i - 3) * 0.03) * u, 0.08 * u, 0.24 * u]}
              color={cyber || i % 2 === 0 ? accent : tones.light}
              metalness={cyber ? 0.84 : 0.4}
              glow={cyber ? glow * 0.3 : glow * 0.08}
            />
            {[-1, 1].map((s) => (
              <Part
                key={`rib-${s}`}
                position={[s * 0.28 * u, 0.7 * u, z * u]}
                scale={[0.06 * u, 0.22 * u, 0.18 * u]}
                color={tones.shadow}
              />
            ))}
            {cyber ? vein([0, 0.66 * u, z * u + 0.15 * u], [0.3 * u, 0.02 * u, 0.02 * u]) : null}
          </group>
        ))}
        <Part position={[0, 0.9 * u, 1.02 * u]} scale={[0.5 * u, 0.46 * u, 0.58 * u]} color={body} />
        <Part position={[0, 0.82 * u, 1.36 * u]} scale={[0.36 * u, 0.26 * u, 0.44 * u]} color={tones.light} />
        <Part position={[0, 0.72 * u, 1.58 * u]} scale={[0.3 * u, 0.14 * u, 0.2 * u]} color={tones.deep} />
        {[-1, 1].map((s) => (
          <group key={`wyrm-eye-${s}`}>
            {eye([s * 0.15 * u, 1.0 * u, 1.26 * u])}
            <Part
              position={[s * 0.18 * u, 1.08 * u, 1.16 * u]}
              scale={[0.2 * u, 0.055 * u, 0.2 * u]}
              rotation={[0, 0, s * 0.18]}
              color={accent}
              metalness={0.76}
              glow={glow * 0.2}
            />
          </group>
        ))}
        {[-1, 1].map((s) => (
          <Spike
            key={`horn-${s}`}
            position={[s * 0.17 * u, 1.26 * u, 0.94 * u]}
            rotation={[-0.58, 0, s * 0.22]}
            size={[0.06 * u, 0.46 * u, 5]}
            color={accent}
            glow={glow * 0.38}
          />
        ))}
        {!cyber ? (
          <group>
            {[-1, 1].map((s) => (
              <Part
                key={`hood-${s}`}
                position={[s * 0.4 * u, 0.94 * u, 1.02 * u]}
                scale={[0.4 * u, 0.08 * u, 0.58 * u]}
                rotation={[0, s * 0.14, s * 0.32]}
                color={tones.mid}
              />
            ))}
            {[-1, 1].map((s) => (
              <Spike
                key={`fang-${s}`}
                position={[s * 0.11 * u, 0.6 * u, 1.56 * u]}
                rotation={[Math.PI, 0, 0]}
                size={[0.034 * u, 0.22 * u, 4]}
                color={tones.light}
              />
            ))}
          </group>
        ) : (
          <group>
            {[-1, 1].map((s) => (
              <Part
                key={`sensor-${s}`}
                position={[s * 0.28 * u, 0.84 * u, 1.32 * u]}
                scale={[0.1 * u, 0.16 * u, 0.22 * u]}
                color={accent}
                metalness={0.88}
                glow={glow * 0.6}
              />
            ))}
            {rune([0, 0.84 * u, 1.58 * u], [0.12 * u, 0.036 * u, 0.028 * u])}
            <Gem position={[0, 0.92 * u, 1.18 * u]} scale={0.045 * u} color={accent} glow={glow} />
            <Spin speed={1.6} axis="z" position={[0, 0.9 * u, 0.74 * u]}>
              <mesh raycast={noRaycast}>
                <torusGeometry args={[0.36 * u, 0.012 * u, 4, 28]} />
                <meshBasicMaterial
                  color={accent}
                  transparent
                  opacity={0.8}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </Spin>
          </group>
        )}
        {[-1, 1].flatMap((s) =>
          [-0.48, 0.08, 0.52].map((z) => (
            <group key={`leg-${s}-${z}`}>
              <Part
                position={[s * 0.3 * u, 0.42 * u, z * u]}
                scale={[0.16 * u, 0.3 * u, 0.16 * u]}
                rotation={[0, 0, -s * 0.14]}
                color={body}
              />
              <Part
                position={[s * 0.35 * u, 0.26 * u, (z + 0.05) * u]}
                scale={[0.2 * u, 0.12 * u, 0.2 * u]}
                color={accent}
                metalness={0.74}
              />
              <Part
                position={[s * 0.36 * u, 0.12 * u, (z + 0.1) * u]}
                scale={[0.14 * u, 0.18 * u, 0.15 * u]}
                color={tones.shadow}
              />
              {[-1, 0, 1].map((c) => (
                <Spike
                  key={c}
                  position={[(s * 0.36 + c * 0.05) * u, 0.045 * u, (z + 0.26) * u]}
                  rotation={[Math.PI / 2, 0, 0]}
                  size={[0.02 * u, 0.12 * u, 4]}
                  color={accent}
                />
              ))}
            </group>
          )),
        )}
        {[0, 1, 2, 3, 4].map((i) => (
          <Part
            key={`tail-${i}`}
            position={[Math.sin(i * 0.36) * 0.14 * u, (0.6 - i * 0.05) * u, (-1.08 - i * 0.3) * u]}
            scale={[(0.36 - i * 0.055) * u, (0.28 - i * 0.03) * u, 0.36 * u]}
            rotation={[0.04 + i * 0.07, 0, -Math.sin(i * 0.36) * 0.2]}
            color={i % 2 ? tones.mid : body}
          />
        ))}
        <Spike
          position={[0.14 * u, 0.34 * u, -2.42 * u]}
          rotation={[Math.PI / 2, 0, 0.22]}
          size={[0.1 * u, 0.54 * u, 6]}
          color={accent}
          glow={glow * 0.4}
        />
        {[-0.7, -0.28, 0.14, 0.56, 0.92].map((z, i) => (
          <Spike
            key={`dorsal-${z}`}
            position={[0, 1.08 * u, z * u]}
            rotation={[0.12, 0, 0]}
            size={[(0.055 + i * 0.008) * u, (0.22 + i * 0.03) * u, 4]}
            color={cyber ? accent : tones.light}
            glow={cyber ? glow * 0.35 : 0}
          />
        ))}
      </group>
    );
  } else {
    const chimera = species === "RUNE CHIMERA";
    creature = (
      <group>
        <Part position={[0, 0.72 * u, -0.08 * u]} scale={[0.56 * u, 0.6 * u, 1.18 * u]} color={body} />
        <Part
          position={[0, 0.94 * u, 0.22 * u]}
          scale={[0.66 * u, 0.26 * u, 0.58 * u]}
          color={tones.mid}
          metalness={0.4}
        />
        <Part position={[0, 0.58 * u, 0.02 * u]} scale={[0.48 * u, 0.16 * u, 0.9 * u]} color={tones.shadow} />
        {/* flank light-runes */}
        {[-1, 1].map((s) => (
          <group key={`flank-${s}`}>
            {vein([s * 0.285 * u, 0.74 * u, -0.1 * u], [0.018 * u, 0.3 * u, 0.7 * u])}
            {vein([s * 0.285 * u, 0.86 * u, 0.3 * u], [0.02 * u, 0.1 * u, 0.1 * u], [0, 0, Math.PI / 4])}
          </group>
        ))}
        {[-1, 1].map((s) => (
          <group key={`shoulder-${s}`}>
            <Part
              position={[s * 0.36 * u, 0.94 * u, 0.3 * u]}
              scale={[0.26 * u, 0.26 * u, 0.44 * u]}
              rotation={[0, 0, s * 0.16]}
              color={accent}
              metalness={0.74}
              glow={glow * 0.25}
            />
            <Part
              position={[s * 0.42 * u, 1.08 * u, 0.22 * u]}
              scale={[0.1 * u, 0.16 * u, 0.22 * u]}
              rotation={[0, 0, s * 0.2]}
              color={tones.gleam}
              metalness={0.64}
              glow={glow * 0.3}
            />
          </group>
        ))}
        {(
          [
            [-0.22, -0.2],
            [-0.08, -0.06],
            [0.08, -0.06],
            [0.22, -0.2],
          ] as const
        ).map(([x, z], i) => (
          <Part
            key={`back-${i}`}
            position={[x * u, 1.07 * u, z * u]}
            scale={[0.14 * u, 0.08 * u, 0.4 * u]}
            color={i === 1 || i === 2 ? accent : tones.light}
            metalness={0.6}
            glow={i === 1 || i === 2 ? glow * 0.3 : 0}
          />
        ))}
        <Part position={[0, 1.2 * u, 0.6 * u]} scale={[0.5 * u, 0.5 * u, 0.52 * u]} color={body} />
        <Part position={[0, 1.1 * u, 0.96 * u]} scale={[0.36 * u, 0.26 * u, 0.44 * u]} color={tones.light} />
        <Part
          position={[0, 1.1 * u, 1.22 * u]}
          scale={[0.24 * u, 0.16 * u, 0.14 * u]}
          color={tones.deep}
          metalness={0.46}
        />
        {[-1, 1].map((s) => (
          <group key={`beast-face-${s}`}>
            {eye([s * 0.15 * u, 1.32 * u, 0.86 * u])}
            <Part
              position={[s * 0.24 * u, 1.2 * u, 0.74 * u]}
              scale={[0.14 * u, 0.24 * u, 0.13 * u]}
              rotation={[0, 0, s * 0.16]}
              color={accent}
              metalness={0.68}
              glow={glow * 0.15}
            />
          </group>
        ))}
        {[-1, 1].map((s) => (
          <group key={`ear-${s}`}>
            <Part
              position={[s * 0.21 * u, 1.6 * u, 0.48 * u]}
              scale={[(chimera ? 0.19 : 0.15) * u, (chimera ? 0.52 : 0.6) * u, 0.2 * u]}
              rotation={[-0.12, 0, -s * 0.18]}
              color={body}
            />
            <Part
              position={[s * 0.21 * u, 1.62 * u, 0.6 * u]}
              scale={[0.07 * u, 0.34 * u, 0.035 * u]}
              rotation={[-0.12, 0, -s * 0.18]}
              color={accent}
              glow={glow * 0.3}
            />
          </group>
        ))}
        {chimera ? (
          <group>
            {[-1, 1].map((s) => (
              <Spike
                key={`chimera-horn-${s}`}
                position={[s * 0.18 * u, 1.7 * u, 0.34 * u]}
                rotation={[-0.38, 0, s * 0.2]}
                size={[0.06 * u, 0.46 * u, 5]}
                color={accent}
                glow={glow * 0.4}
              />
            ))}
            {rune([0, 1.44 * u, 0.78 * u], [0.1 * u, 0.1 * u, 0.028 * u], [0, 0, Math.PI / 4])}
            <Gem position={[0, 1.44 * u, 0.82 * u]} scale={0.042 * u} color={accent} glow={glow} />
            <Spin speed={1.4} axis="z" position={[0, 1.44 * u, 0.84 * u]}>
              <mesh raycast={noRaycast}>
                <torusGeometry args={[0.1 * u, 0.006 * u, 4, 20]} />
                <meshBasicMaterial
                  color={accent}
                  transparent
                  opacity={0.85}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </Spin>
          </group>
        ) : (
          <group>
            {[-1, 1].map((s) => (
              <Spike
                key={`storm-rod-${s}`}
                position={[s * 0.3 * u, 1.48 * u, 0.26 * u]}
                rotation={[0, 0, -s * 0.35]}
                size={[0.045 * u, 0.34 * u, 4]}
                color={accent}
                glow={glow * 0.7}
              />
            ))}
            <Part
              position={[0, 1.36 * u, 0.52 * u]}
              scale={[0.16 * u, 0.06 * u, 0.08 * u]}
              color={accent}
              glow={glow * 0.45}
            />
          </group>
        )}
        {[-1, 1].flatMap((s) =>
          [-0.36, 0.4].map((z) => (
            <group key={`paw-${s}-${z}`}>
              <Part
                position={[s * 0.26 * u, 0.48 * u, z * u]}
                scale={[0.2 * u, 0.44 * u, 0.22 * u]}
                rotation={[s * 0.04, 0, -s * 0.08]}
                color={body}
              />
              <Part
                position={[s * 0.28 * u, 0.28 * u, (z - 0.06) * u]}
                scale={[0.23 * u, 0.16 * u, 0.26 * u]}
                color={accent}
                metalness={0.72}
                glow={glow * 0.12}
              />
              <Part
                position={[s * 0.28 * u, 0.13 * u, (z + 0.06) * u]}
                scale={[0.17 * u, 0.2 * u, 0.2 * u]}
                color={tones.shadow}
              />
              <Part
                position={[s * 0.28 * u, 0.055 * u, (z + 0.22) * u]}
                scale={[0.3 * u, 0.1 * u, 0.36 * u]}
                color={body}
              />
              {[-1, 0, 1].map((c) => (
                <Spike
                  key={c}
                  position={[(s * 0.28 + c * 0.07) * u, 0.05 * u, (z + 0.42) * u]}
                  rotation={[Math.PI / 2, 0, 0]}
                  size={[0.02 * u, 0.13 * u, 4]}
                  color={accent}
                />
              ))}
            </group>
          )),
        )}
        {[0, 1, 2, 3, 4].map((i) => (
          <Part
            key={`tail-${i}`}
            position={[Math.sin(i * 0.52) * 0.18 * u, (0.76 + i * 0.085) * u, (-0.8 - i * 0.26) * u]}
            scale={[(0.2 - i * 0.022) * u, (0.2 - i * 0.022) * u, 0.32 * u]}
            rotation={[-0.28, 0, -Math.sin(i * 0.52) * 0.28]}
            color={i % 2 ? accent : body}
            metalness={i % 2 ? 0.64 : 0.22}
            glow={i % 2 ? glow * 0.3 : 0}
          />
        ))}
        {chimera ? (
          <Spike
            position={[0.2 * u, 1.1 * u, -1.96 * u]}
            rotation={[Math.PI / 2, 0, 0.28]}
            size={[0.1 * u, 0.44 * u, 5]}
            color={accent}
            glow={glow * 0.6}
          />
        ) : (
          <group>
            {[-1, 1].map((s) => (
              <Spike
                key={`fork-${s}`}
                position={[(0.2 + s * 0.09) * u, 1.06 * u, -1.94 * u]}
                rotation={[Math.PI / 2, 0, s * 0.25]}
                size={[0.055 * u, 0.32 * u, 4]}
                color={accent}
                glow={glow * 0.7}
              />
            ))}
          </group>
        )}
      </group>
    );
  }

  return (
    <HoloCtx.Provider value={holo}>
      <group ref={root} raycast={noRaycast}>
        <HoloPlinth rarity={rarity} accent={accent} u={u} glow={glow} />
        <group ref={motion}>{creature}</group>
        <RarityRegalia rarity={rarity} accent={accent} u={u} glow={glow} />
      </group>
    </HoloCtx.Provider>
  );
});

export function GuardianBody(props: {
  species: GuardianSpecies;
  rarity: GuardianRarity;
  body: string;
  accent: string;
  unit?: number;
  height?: number | undefined;
}) {
  const { height, ...rest } = props;
  const dna = useQuery({ ...guardianDnaQuery(height ?? 0), enabled: height != null, staleTime: Infinity });
  const morph = useMemo(() => (dna.data ? morphFromDna(dna.data) : null), [dna.data]);
  if (height != null && morph) return <MorphBody m={morph} unit={(rest.unit ?? 1) * 1.1} rarity={rest.rarity} />;
  return <SpeciesBody {...rest} />;
}
