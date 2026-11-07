/** Premium procedural Guardian bodies, built only from species and block-derived colours. */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { morphFromDna } from "@/lib/creature-morph";
import { MorphBody } from "@/components/bitmon/MorphBody";
import { OnchainGuardianBody } from "@/components/bitmon/OnchainGuardianBody";
/** Render every block-known Guardian with the inscription's own voxel generator. */
const ONCHAIN_STYLE = true;
import { shapeOf, type GuardianRarity, type GuardianSpecies } from "@/lib/bitmon";

const noRaycast = () => {};
type Vec3 = [number, number, number];

function Part({
  position,
  scale,
  rotation,
  color,
  metalness = 0.18,
  roughness = 0.62,
  glow = 0,
}: {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  color: string;
  metalness?: number;
  roughness?: number;
  glow?: number;
}) {
  return (
    <mesh position={position} {...(rotation ? { rotation } : {})} castShadow receiveShadow raycast={noRaycast}>
      <boxGeometry args={scale} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow}
        metalness={metalness}
        roughness={roughness}
        flatShading
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
}: {
  position: Vec3;
  rotation?: Vec3;
  size: Vec3;
  color: string;
  glow?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow raycast={noRaycast}>
      <coneGeometry args={[size[0], size[1], Math.max(4, Math.round(size[2]))]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow}
        metalness={0.56}
        roughness={0.34}
        flatShading
      />
    </mesh>
  );
}

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
  const points = rarity === "MYTHIC" ? 8 : rarity === "EPIC" ? 6 : 4;
  return (
    <group raycast={noRaycast}>
      {Array.from({ length: points }, (_, i) => {
        const angle = (i / points) * Math.PI * 2;
        const radius = (rarity === "MYTHIC" ? 0.76 : 0.66) * u;
        return (
          <group key={i} position={[Math.sin(angle) * radius, 1.18 * u, Math.cos(angle) * radius]} rotation-y={angle}>
            <Part
              position={[0, 0, 0]}
              scale={[0.055 * u, (rarity === "MYTHIC" ? 0.24 : 0.15) * u, 0.055 * u]}
              rotation={[0, 0, i % 2 ? 0.35 : -0.35]}
              color={accent}
              metalness={0.72}
              roughness={0.2}
              glow={glow * 0.45}
            />
          </group>
        );
      })}
      {rarity === "MYTHIC" ? (
        <mesh position={[0, 1.22 * u, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
          <torusGeometry args={[0.82 * u, 0.018 * u, 4, 20]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={glow} transparent opacity={0.72} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * Ground light pool plus orbiting energy motes. Purely decorative and driven by
 * rarity, so a COMMON Guardian keeps a quiet silhouette.
 */
function EnergyAura({ rarity, accent, u, glow }: { rarity: GuardianRarity; accent: string; u: number; glow: number }) {
  const motes = useRef<THREE.Group>(null);
  const count = rarity === "MYTHIC" ? 10 : rarity === "EPIC" ? 7 : rarity === "RARE" ? 4 : 0;
  useFrame(({ clock }) => {
    if (!motes.current) return;
    const t = clock.elapsedTime;
    motes.current.rotation.y = t * 0.45;
    motes.current.children.forEach((child, i) => {
      child.position.y = (0.35 + Math.sin(t * 1.5 + i) * 0.28 + i * 0.06) * u;
      const s = 0.7 + (Math.sin(t * 3 + i * 1.7) + 1) * 0.35;
      child.scale.setScalar(s);
    });
  });
  return (
    <group raycast={noRaycast}>
      <mesh position={[0, 0.012 * u, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <circleGeometry args={[(rarity === "MYTHIC" ? 1.15 : 0.95) * u, 28]} />
        <meshBasicMaterial color={accent} transparent opacity={0.07 + glow * 0.05} depthWrite={false} />
      </mesh>
      <group ref={motes}>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / Math.max(1, count)) * Math.PI * 2;
          const radius = (0.62 + (i % 3) * 0.14) * u;
          return (
            <mesh key={i} position={[Math.sin(angle) * radius, 0.5 * u, Math.cos(angle) * radius]} raycast={noRaycast}>
              <boxGeometry args={[0.035 * u, 0.035 * u, 0.035 * u]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={glow + 0.9}
                transparent
                opacity={0.85}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

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
  const glow = rarity === "MYTHIC" ? 1.4 : rarity === "EPIC" ? 0.8 : rarity === "RARE" ? 0.4 : 0.15;
  const tones = useMemo(() => {
    const base = new THREE.Color(body);
    return {
      shadow: `#${base.clone().multiplyScalar(0.48).getHexString()}`,
      mid: `#${base.clone().lerp(new THREE.Color(accent), 0.16).getHexString()}`,
      light: `#${base.clone().lerp(new THREE.Color("#ffffff"), 0.2).getHexString()}`,
    };
  }, [body, accent]);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.elapsedTime + species.length * 0.37;
    if (root.current) {
      const target = 1 + Math.sin(t * 1.7) * 0.012;
      root.current.scale.y = THREE.MathUtils.damp(root.current.scale.y, target, 7, dt);
    }
    if (motion.current) {
      motion.current.rotation.y = Math.sin(t * 0.72) * 0.055;
      motion.current.position.y = (shape === "wisp" ? Math.sin(t * 1.8) * 0.08 : Math.sin(t * 1.4) * 0.018) * u;
      // Breathing light: every lit plate, eye and rune pulses around its own base level.
      const pulse = 0.72 + (Math.sin(t * 2.1) + 1) * 0.3;
      motion.current.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (!mat || !("emissiveIntensity" in mat)) return;
        if (mesh.userData["glowBase"] === undefined) {
          if (mat.emissiveIntensity <= 0.001) return;
          mesh.userData["glowBase"] = mat.emissiveIntensity;
        }
        mat.emissiveIntensity = (mesh.userData["glowBase"] as number) * pulse;
      });
    }
  });

  const eye = (position: Vec3, scale: Vec3 = [0.055 * u, 0.055 * u, 0.035 * u]) => (
    <Part position={position} scale={scale} color={accent} metalness={0.25} roughness={0.2} glow={glow + 0.75} />
  );
  const rune = (position: Vec3, scale: Vec3, rotation?: Vec3) => (
    <Part
      position={position}
      scale={scale}
      {...(rotation ? { rotation } : {})}
      color={accent}
      metalness={0.58}
      roughness={0.22}
      glow={glow * 0.72}
    />
  );

  let creature: React.ReactNode;

  if (shape === "golem") {
    const obsidian = species === "OBSIDIAN BEHEMOTH";
    creature = (
      <group>
        {/* Layered fortress torso, inset reactor and spinal armor. */}
        <Part
          position={[0, 1.02 * u, 0]}
          scale={[0.92 * u, 0.82 * u, 0.62 * u]}
          color={body}
          metalness={obsidian ? 0.42 : 0.28}
        />
        <Part
          position={[0, 1.18 * u, -0.34 * u]}
          scale={[0.62 * u, 0.56 * u, 0.12 * u]}
          color={tones.shadow}
          metalness={0.55}
          roughness={0.35}
        />
        {[-1, 0, 1].map((x) => (
          <Part
            key={`spine-${x}`}
            position={[x * 0.23 * u, 1.42 * u, -0.38 * u]}
            scale={[0.16 * u, 0.1 * u, 0.16 * u]}
            rotation={[0.2, 0, x * 0.12]}
            color={x === 0 ? accent : tones.mid}
            metalness={0.65}
            glow={x === 0 ? glow * 0.4 : 0}
          />
        ))}
        <Part
          position={[0, 1.12 * u, 0.325 * u]}
          scale={[0.6 * u, 0.42 * u, 0.055 * u]}
          color={tones.shadow}
          metalness={0.72}
          roughness={0.25}
        />
        {[-1, 1].map((s) => (
          <Part
            key={`chest-${s}`}
            position={[s * 0.18 * u, 1.18 * u, 0.36 * u]}
            scale={[0.23 * u, 0.3 * u, 0.045 * u]}
            rotation={[0, 0, s * 0.12]}
            color={tones.light}
            metalness={0.5}
          />
        ))}
        {rune([0, 1.08 * u, 0.395 * u], [0.13 * u, 0.13 * u, 0.025 * u], [0, 0, Math.PI / 4])}
        {[-1, 1].map((s) => (
          <Part
            key={`vent-${s}`}
            position={[s * 0.3 * u, 0.91 * u, 0.385 * u]}
            scale={[0.1 * u, 0.035 * u, 0.025 * u]}
            color={accent}
            glow={glow * 0.4}
          />
        ))}

        {/* Helmet with brow, jaw, cheek guards and species crest. */}
        <Part position={[0, 1.68 * u, 0.02 * u]} scale={[0.56 * u, 0.44 * u, 0.48 * u]} color={body} />
        <Part
          position={[0, 1.89 * u, -0.02 * u]}
          scale={[0.44 * u, 0.12 * u, 0.38 * u]}
          color={tones.light}
          metalness={0.62}
          roughness={0.3}
        />
        <Part
          position={[0, 1.58 * u, 0.29 * u]}
          scale={[0.34 * u, 0.1 * u, 0.08 * u]}
          color={tones.shadow}
          metalness={0.48}
        />
        {[-1, 1].map((s) => (
          <group key={`face-${s}`}>
            {eye([s * 0.13 * u, 1.72 * u, 0.27 * u], [0.09 * u, 0.055 * u, 0.035 * u])}
            <Part
              position={[s * 0.22 * u, 1.55 * u, 0.25 * u]}
              scale={[0.13 * u, 0.18 * u, 0.08 * u]}
              rotation={[0, 0, s * 0.14]}
              color={tones.mid}
              metalness={0.55}
            />
          </group>
        ))}
        {obsidian ? (
          [-1, 0, 1].map((x) => (
            <Spike
              key={`crown-${x}`}
              position={[x * 0.18 * u, (1.99 + (x === 0 ? 0.09 : 0)) * u, -0.03 * u]}
              rotation={[0, 0, -x * 0.16]}
              size={[0.075 * u, (x === 0 ? 0.35 : 0.25) * u, 4]}
              color={accent}
              glow={glow * 0.35}
            />
          ))
        ) : (
          <Part
            position={[0, 2.0 * u, 0]}
            scale={[0.16 * u, 0.13 * u, 0.34 * u]}
            color={accent}
            metalness={0.72}
            glow={glow * 0.3}
          />
        )}

        {/* Articulated arms, piston elbows and individually plated fists. */}
        {[-1, 1].map((s) => (
          <group key={`arm-${s}`}>
            <Part
              position={[s * 0.67 * u, 1.42 * u, 0]}
              scale={[0.42 * u, 0.36 * u, 0.54 * u]}
              rotation={[0, 0, s * 0.1]}
              color={body}
            />
            <Part
              position={[s * 0.72 * u, 1.58 * u, 0]}
              scale={[0.48 * u, 0.13 * u, 0.58 * u]}
              rotation={[0, 0, s * 0.12]}
              color={accent}
              metalness={0.72}
              roughness={0.26}
            />
            {obsidian ? (
              <Spike
                position={[s * 0.72 * u, 1.82 * u, -0.05 * u]}
                rotation={[0, 0, -s * 0.2]}
                size={[0.09 * u, 0.35 * u, 4]}
                color={accent}
                glow={glow * 0.3}
              />
            ) : null}
            <Part
              position={[s * 0.66 * u, 1.03 * u, 0]}
              scale={[0.22 * u, 0.46 * u, 0.26 * u]}
              color={tones.shadow}
              metalness={0.45}
            />
            <Part
              position={[s * 0.66 * u, 0.82 * u, 0.01 * u]}
              scale={[0.29 * u, 0.16 * u, 0.32 * u]}
              color={accent}
              metalness={0.72}
              glow={glow * 0.2}
            />
            <Part position={[s * 0.66 * u, 0.58 * u, 0.1 * u]} scale={[0.38 * u, 0.34 * u, 0.42 * u]} color={body} />
            {[-1, 0, 1].map((f) => (
              <Part
                key={`finger-${f}`}
                position={[(s * 0.66 + f * 0.1) * u, 0.43 * u, 0.31 * u]}
                scale={[0.075 * u, 0.13 * u, 0.18 * u]}
                color={tones.light}
                metalness={0.4}
              />
            ))}
          </group>
        ))}

        {/* Split armored legs and broad grounded feet. */}
        {[-1, 1].map((s) => (
          <group key={`leg-${s}`}>
            <Part position={[s * 0.26 * u, 0.55 * u, 0]} scale={[0.31 * u, 0.5 * u, 0.34 * u]} color={body} />
            <Part
              position={[s * 0.26 * u, 0.43 * u, 0.19 * u]}
              scale={[0.34 * u, 0.2 * u, 0.08 * u]}
              color={accent}
              metalness={0.68}
            />
            <Part
              position={[s * 0.26 * u, 0.2 * u, 0.01 * u]}
              scale={[0.27 * u, 0.28 * u, 0.3 * u]}
              color={tones.shadow}
            />
            <Part position={[s * 0.26 * u, 0.07 * u, 0.13 * u]} scale={[0.42 * u, 0.14 * u, 0.55 * u]} color={body} />
            {[-1, 0, 1].map((toe) => (
              <Part
                key={`toe-${toe}`}
                position={[(s * 0.26 + toe * 0.105) * u, 0.075 * u, 0.43 * u]}
                scale={[0.075 * u, 0.08 * u, 0.18 * u]}
                color={accent}
                metalness={0.7}
                glow={glow * 0.12}
              />
            ))}
          </group>
        ))}
      </group>
    );
  } else if (shape === "wisp") {
    creature = (
      <group>
        {/* Faceted spectral core under a deep segmented cowl. */}
        <mesh position={[0, 1.2 * u, 0]} castShadow raycast={noRaycast}>
          <icosahedronGeometry args={[0.46 * u, 1]} />
          <meshPhysicalMaterial
            color={body}
            emissive={accent}
            emissiveIntensity={0.25 + glow * 0.5}
            roughness={0.18}
            metalness={0.12}
            transparent
            opacity={0.82}
            clearcoat={0.7}
          />
        </mesh>
        <Part
          position={[0, 1.48 * u, -0.08 * u]}
          scale={[0.65 * u, 0.18 * u, 0.52 * u]}
          color={tones.shadow}
          metalness={0.45}
          roughness={0.4}
        />
        {[-1, 1].map((s) => (
          <Part
            key={`hood-${s}`}
            position={[s * 0.27 * u, 1.29 * u, 0.05 * u]}
            scale={[0.2 * u, 0.48 * u, 0.48 * u]}
            rotation={[0, 0, s * 0.18]}
            color={tones.shadow}
            metalness={0.38}
          />
        ))}
        <Part
          position={[0, 1.06 * u, 0.35 * u]}
          scale={[0.38 * u, 0.34 * u, 0.08 * u]}
          color={tones.shadow}
          metalness={0.5}
        />
        {[-1, 1].map((s) => <group key={s}>{eye([s * 0.105 * u, 1.2 * u, 0.41 * u], [0.075 * u, 0.045 * u, 0.025 * u])}</group>)}
        {rune([0, 1.03 * u, 0.405 * u], [0.055 * u, 0.13 * u, 0.025 * u])}
        <mesh position={[0, 1.2 * u, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <torusGeometry args={[0.55 * u, 0.025 * u, 4, 12]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={glow} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.2 * u, 0]} rotation={[0, Math.PI / 4, Math.PI / 3]} raycast={noRaycast}>
          <torusGeometry args={[0.68 * u, 0.018 * u, 4, 12]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={glow * 0.75}
            transparent
            opacity={0.75}
          />
        </mesh>
        {/* Floating gauntlets and torn spectral mantle. */}
        {[-1, 1].map((s) => (
          <group key={`hand-${s}`} position={[s * 0.7 * u, 0.96 * u, 0.08 * u]} rotation-z={-s * 0.25}>
            <Part position={[0, 0, 0]} scale={[0.25 * u, 0.2 * u, 0.28 * u]} color={tones.mid} metalness={0.52} />
            {[-1, 0, 1].map((f) => (
              <Part
                key={f}
                position={[f * 0.07 * u, -0.12 * u, 0.12 * u]}
                scale={[0.05 * u, 0.18 * u, 0.06 * u]}
                color={accent}
                glow={glow * 0.35}
              />
            ))}
          </group>
        ))}
        {[0, 1, 2, 3, 4].map((i) => {
          const a = i * 1.256;
          return (
            <Spike
              key={`trail-${i}`}
              position={[
                Math.sin(a) * (0.18 + (i % 2) * 0.14) * u,
                (0.52 - (i % 3) * 0.08) * u,
                Math.cos(a) * (0.18 + (i % 2) * 0.14) * u,
              ]}
              rotation={[Math.PI, 0, a]}
              size={[0.09 * u, (0.5 - (i % 2) * 0.12) * u, 5]}
              color={i % 2 ? accent : body}
              glow={i % 2 ? glow * 0.3 : 0}
            />
          );
        })}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i * Math.PI) / 3;
          return (
            <mesh
              key={`shard-${i}`}
              position={[Math.sin(a) * 0.72 * u, (1.1 + Math.sin(a * 2) * 0.22) * u, Math.cos(a) * 0.72 * u]}
              rotation={[a, a * 0.7, 0]}
              raycast={noRaycast}
            >
              <octahedronGeometry args={[0.075 * u, 0]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={glow * 0.8}
                metalness={0.65}
                roughness={0.2}
              />
            </mesh>
          );
        })}
      </group>
    );
  } else if (shape === "bird") {
    creature = (
      <group>
        {/* Gryphon body: feathered eagle front, plated feline rear. */}
        <Part position={[0, 0.82 * u, -0.08 * u]} scale={[0.52 * u, 0.54 * u, 1.05 * u]} color={body} />
        {(
          [
            [-0.18, 0.12],
            [0, 0.06],
            [0.18, 0.12],
          ] as const
        ).map(([x, y], i) => (
          <Part
            key={`breast-${i}`}
            position={[x * u, (0.94 + y) * u, 0.46 * u]}
            scale={[0.17 * u, 0.3 * u, 0.1 * u]}
            rotation={[0.15, 0, x * 0.4]}
            color={i === 1 ? tones.light : tones.mid}
          />
        ))}
        <Part position={[0, 1.28 * u, 0.48 * u]} scale={[0.42 * u, 0.42 * u, 0.42 * u]} color={body} />
        <Part position={[0, 1.22 * u, 0.78 * u]} scale={[0.28 * u, 0.2 * u, 0.28 * u]} color={tones.light} />
        <Spike
          position={[0, 1.18 * u, 0.98 * u]}
          rotation={[Math.PI / 2, 0, 0]}
          size={[0.11 * u, 0.35 * u, 4]}
          color={accent}
          glow={glow * 0.24}
        />
        {[-1, 1].map((s) => (
          <group key={`bird-face-${s}`}>
            {eye([s * 0.12 * u, 1.36 * u, 0.7 * u])}
            <Part
              position={[s * 0.2 * u, 1.43 * u, 0.38 * u]}
              scale={[0.12 * u, 0.2 * u, 0.18 * u]}
              rotation={[0, 0, s * 0.22]}
              color={accent}
              metalness={0.6}
            />
          </group>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <Spike
            key={`crest-${i}`}
            position={[(i - 1.5) * 0.1 * u, (1.56 - Math.abs(i - 1.5) * 0.04) * u, 0.38 * u]}
            rotation={[-0.25, 0, (i - 1.5) * -0.08]}
            size={[0.045 * u, (0.25 - Math.abs(i - 1.5) * 0.025) * u, 4]}
            color={i % 2 ? accent : tones.light}
            glow={i % 2 ? glow * 0.25 : 0}
          />
        ))}
        {/* Broad layered wings with primary, secondary and covert feathers. */}
        {[-1, 1].map((s) => (
          <group key={`wing-${s}`} rotation-z={s * 0.08}>
            <Part
              position={[s * 0.55 * u, 1.02 * u, -0.05 * u]}
              scale={[0.62 * u, 0.12 * u, 0.7 * u]}
              rotation={[0, s * 0.08, s * 0.25]}
              color={accent}
              metalness={0.52}
              glow={glow * 0.18}
            />
            {[0, 1, 2, 3, 4].map((f) => (
              <Part
                key={`primary-${f}`}
                position={[s * (0.72 + f * 0.19) * u, (0.97 - f * 0.06) * u, (-0.1 - f * 0.1) * u]}
                scale={[(0.44 - f * 0.035) * u, 0.045 * u, 0.15 * u]}
                rotation={[0, s * (0.1 + f * 0.035), s * (0.32 + f * 0.045)]}
                color={f % 2 ? tones.light : body}
                metalness={0.25}
              />
            ))}
            {[0, 1, 2].map((f) => (
              <Part
                key={`covert-${f}`}
                position={[s * (0.48 + f * 0.18) * u, (1.11 - f * 0.025) * u, (0.17 - f * 0.14) * u]}
                scale={[0.33 * u, 0.065 * u, 0.19 * u]}
                rotation={[0, s * 0.08, s * (0.18 + f * 0.05)]}
                color={f === 1 ? accent : tones.mid}
                metalness={0.42}
                glow={f === 1 ? glow * 0.12 : 0}
              />
            ))}
          </group>
        ))}
        {/* Eagle talons, feline hind paws, and a feather fan tail. */}
        {[-1, 1].map((s) => (
          <group key={`talon-${s}`}>
            <Part
              position={[s * 0.17 * u, 0.35 * u, 0.35 * u]}
              scale={[0.12 * u, 0.55 * u, 0.12 * u]}
              color={tones.light}
            />
            <Part position={[s * 0.17 * u, 0.08 * u, 0.49 * u]} scale={[0.2 * u, 0.1 * u, 0.3 * u]} color={body} />
            {[-1, 0, 1].map((c) => (
              <Spike
                key={c}
                position={[(s * 0.17 + c * 0.06) * u, 0.06 * u, 0.7 * u]}
                rotation={[Math.PI / 2, 0, 0]}
                size={[0.025 * u, 0.15 * u, 4]}
                color={accent}
              />
            ))}
          </group>
        ))}
        {[-1, 0, 1].map((f) => (
          <Part
            key={`tail-${f}`}
            position={[f * 0.13 * u, 0.73 * u, -0.83 * u]}
            scale={[0.12 * u, 0.07 * u, 0.72 * u]}
            rotation={[-0.3, f * -0.12, 0]}
            color={f === 0 ? accent : tones.light}
            metalness={f === 0 ? 0.5 : 0.18}
          />
        ))}
      </group>
    );
  } else if (shape === "wyrm") {
    const cyber = species === "CYBER WYRM";
    creature = (
      <group>
        {/* Long segmented body with distinct Cyber plating or Basilisk hood. */}
        {[-0.72, -0.36, 0, 0.36, 0.72].map((z, i) => (
          <group key={`segment-${i}`}>
            <Part
              position={[0, (0.62 + (2 - Math.abs(i - 2)) * 0.045) * u, z * u]}
              scale={[(0.54 - Math.abs(i - 2) * 0.045) * u, 0.42 * u, 0.42 * u]}
              color={i % 2 ? tones.mid : body}
            />
            <Part
              position={[0, 0.86 * u, z * u]}
              scale={[(0.42 - Math.abs(i - 2) * 0.035) * u, 0.09 * u, 0.3 * u]}
              color={cyber || i % 2 === 0 ? accent : tones.light}
              metalness={cyber ? 0.76 : 0.34}
              glow={cyber ? glow * 0.15 : 0}
            />
          </group>
        ))}
        <Part position={[0, 0.88 * u, 0.96 * u]} scale={[0.48 * u, 0.42 * u, 0.56 * u]} color={body} />
        <Part position={[0, 0.8 * u, 1.3 * u]} scale={[0.34 * u, 0.25 * u, 0.42 * u]} color={tones.light} />
        <Part position={[0, 0.72 * u, 1.51 * u]} scale={[0.28 * u, 0.13 * u, 0.18 * u]} color={tones.shadow} />
        {[-1, 1].map((s) => (
          <group key={`wyrm-eye-${s}`}>
            {eye([s * 0.14 * u, 0.98 * u, 1.21 * u])}
            <Part
              position={[s * 0.16 * u, 1.05 * u, 1.13 * u]}
              scale={[0.18 * u, 0.055 * u, 0.18 * u]}
              rotation={[0, 0, s * 0.18]}
              color={accent}
              metalness={0.7}
            />
          </group>
        ))}
        {[-1, 1].map((s) => (
          <Spike
            key={`horn-${s}`}
            position={[s * 0.16 * u, 1.22 * u, 0.91 * u]}
            rotation={[-0.55, 0, s * 0.2]}
            size={[0.065 * u, 0.42 * u, 4]}
            color={accent}
            glow={glow * 0.25}
          />
        ))}
        {!cyber ? (
          <group>
            {[-1, 1].map((s) => (
              <Part
                key={`hood-${s}`}
                position={[s * 0.38 * u, 0.92 * u, 0.99 * u]}
                scale={[0.38 * u, 0.08 * u, 0.54 * u]}
                rotation={[0, s * 0.14, s * 0.3]}
                color={tones.mid}
              />
            ))}
            {[-1, 1].map((s) => (
              <Spike
                key={`fang-${s}`}
                position={[s * 0.11 * u, 0.61 * u, 1.48 * u]}
                rotation={[Math.PI, 0, 0]}
                size={[0.035 * u, 0.2 * u, 4]}
                color={tones.light}
              />
            ))}
          </group>
        ) : (
          <group>
            {[-1, 1].map((s) => (
              <Part
                key={`sensor-${s}`}
                position={[s * 0.26 * u, 0.82 * u, 1.27 * u]}
                scale={[0.1 * u, 0.14 * u, 0.2 * u]}
                color={accent}
                metalness={0.8}
                glow={glow * 0.4}
              />
            ))}
            {rune([0, 0.83 * u, 1.52 * u], [0.1 * u, 0.035 * u, 0.025 * u])}
          </group>
        )}
        {/* Four jointed legs with plated knees and claws. */}
        {[-1, 1].flatMap((s) =>
          [-0.4, 0.42].map((z) => (
            <group key={`leg-${s}-${z}`}>
              <Part
                position={[s * 0.29 * u, 0.42 * u, z * u]}
                scale={[0.17 * u, 0.3 * u, 0.18 * u]}
                rotation={[0, 0, -s * 0.14]}
                color={body}
              />
              <Part
                position={[s * 0.34 * u, 0.27 * u, (z + 0.05) * u]}
                scale={[0.22 * u, 0.14 * u, 0.22 * u]}
                color={accent}
                metalness={0.68}
              />
              <Part
                position={[s * 0.35 * u, 0.12 * u, (z + 0.1) * u]}
                scale={[0.15 * u, 0.2 * u, 0.16 * u]}
                color={tones.shadow}
              />
              {[-1, 0, 1].map((c) => (
                <Spike
                  key={c}
                  position={[(s * 0.35 + c * 0.055) * u, 0.05 * u, (z + 0.27) * u]}
                  rotation={[Math.PI / 2, 0, 0]}
                  size={[0.022 * u, 0.13 * u, 4]}
                  color={accent}
                />
              ))}
            </group>
          )),
        )}
        {/* Tapered articulated tail. */}
        {[0, 1, 2, 3].map((i) => (
          <Part
            key={`tail-${i}`}
            position={[Math.sin(i * 0.38) * 0.13 * u, (0.6 - i * 0.055) * u, (-1.02 - i * 0.33) * u]}
            scale={[(0.38 - i * 0.07) * u, (0.3 - i * 0.035) * u, 0.42 * u]}
            rotation={[0.04 + i * 0.08, 0, -Math.sin(i * 0.38) * 0.2]}
            color={i % 2 ? tones.mid : body}
          />
        ))}
        <Spike
          position={[0.13 * u, 0.35 * u, -2.25 * u]}
          rotation={[Math.PI / 2, 0, 0.22]}
          size={[0.1 * u, 0.5 * u, 5]}
          color={accent}
          glow={glow * 0.22}
        />
        {[-0.52, -0.12, 0.28, 0.68].map((z, i) => (
          <Spike
            key={`dorsal-${z}`}
            position={[0, 1.05 * u, z * u]}
            rotation={[0.1, 0, 0]}
            size={[(0.06 + i * 0.008) * u, (0.24 + i * 0.035) * u, 4]}
            color={cyber ? accent : tones.light}
            glow={cyber ? glow * 0.22 : 0}
          />
        ))}
      </group>
    );
  } else {
    const chimera = species === "RUNE CHIMERA";
    creature = (
      <group>
        {/* Jackal/Chimera athletic body with layered shoulder and flank armor. */}
        <Part position={[0, 0.72 * u, -0.08 * u]} scale={[0.54 * u, 0.58 * u, 1.14 * u]} color={body} />
        <Part
          position={[0, 0.91 * u, 0.2 * u]}
          scale={[0.62 * u, 0.25 * u, 0.55 * u]}
          color={tones.mid}
          metalness={0.34}
        />
        {[-1, 1].map((s) => (
          <Part
            key={`shoulder-${s}`}
            position={[s * 0.34 * u, 0.92 * u, 0.28 * u]}
            scale={[0.24 * u, 0.24 * u, 0.42 * u]}
            rotation={[0, 0, s * 0.16]}
            color={accent}
            metalness={0.68}
            glow={glow * 0.15}
          />
        ))}
        {(
          [
            [-0.2, -0.18],
            [0, -0.05],
            [0.2, -0.18],
          ] as const
        ).map(([x, z], i) => (
          <Part
            key={`back-${i}`}
            position={[x * u, 1.055 * u, z * u]}
            scale={[0.15 * u, 0.08 * u, 0.42 * u]}
            color={i === 1 ? accent : tones.light}
            metalness={0.55}
            glow={i === 1 ? glow * 0.18 : 0}
          />
        ))}
        {/* Angular expressive head, long muzzle, nose, cheek plates. */}
        <Part position={[0, 1.18 * u, 0.58 * u]} scale={[0.48 * u, 0.48 * u, 0.5 * u]} color={body} />
        <Part position={[0, 1.08 * u, 0.93 * u]} scale={[0.34 * u, 0.25 * u, 0.42 * u]} color={tones.light} />
        <Part
          position={[0, 1.08 * u, 1.17 * u]}
          scale={[0.24 * u, 0.16 * u, 0.12 * u]}
          color={tones.shadow}
          metalness={0.4}
        />
        {[-1, 1].map((s) => (
          <group key={`beast-face-${s}`}>
            {eye([s * 0.14 * u, 1.3 * u, 0.84 * u])}
            <Part
              position={[s * 0.22 * u, 1.18 * u, 0.73 * u]}
              scale={[0.13 * u, 0.23 * u, 0.12 * u]}
              rotation={[0, 0, s * 0.16]}
              color={accent}
              metalness={0.62}
            />
          </group>
        ))}
        {[-1, 1].map((s) => (
          <group key={`ear-${s}`}>
            <Part
              position={[s * 0.2 * u, 1.57 * u, 0.48 * u]}
              scale={[(chimera ? 0.18 : 0.14) * u, (chimera ? 0.5 : 0.58) * u, 0.19 * u]}
              rotation={[-0.12, 0, -s * 0.18]}
              color={body}
            />
            <Part
              position={[s * 0.2 * u, 1.59 * u, 0.59 * u]}
              scale={[0.07 * u, 0.32 * u, 0.035 * u]}
              rotation={[-0.12, 0, -s * 0.18]}
              color={accent}
              glow={glow * 0.18}
            />
          </group>
        ))}
        {chimera ? (
          <group>
            {[-1, 1].map((s) => (
              <Spike
                key={`chimera-horn-${s}`}
                position={[s * 0.17 * u, 1.66 * u, 0.34 * u]}
                rotation={[-0.36, 0, s * 0.2]}
                size={[0.06 * u, 0.42 * u, 5]}
                color={accent}
                glow={glow * 0.26}
              />
            ))}
            {rune([0, 1.42 * u, 0.76 * u], [0.09 * u, 0.09 * u, 0.025 * u], [0, 0, Math.PI / 4])}
          </group>
        ) : (
          <group>
            {[-1, 1].map((s) => (
              <Spike
                key={`storm-rod-${s}`}
                position={[s * 0.28 * u, 1.46 * u, 0.26 * u]}
                rotation={[0, 0, -s * 0.35]}
                size={[0.045 * u, 0.3 * u, 4]}
                color={accent}
                glow={glow * 0.55}
              />
            ))}
          </group>
        )}
        {/* Digitigrade legs with hocks, plated paws and claws. */}
        {[-1, 1].flatMap((s) =>
          [-0.34, 0.38].map((z) => (
            <group key={`paw-${s}-${z}`}>
              <Part
                position={[s * 0.25 * u, 0.47 * u, z * u]}
                scale={[0.19 * u, 0.43 * u, 0.22 * u]}
                rotation={[s * 0.04, 0, -s * 0.08]}
                color={body}
              />
              <Part
                position={[s * 0.27 * u, 0.28 * u, (z - 0.06) * u]}
                scale={[0.22 * u, 0.16 * u, 0.25 * u]}
                color={accent}
                metalness={0.66}
              />
              <Part
                position={[s * 0.27 * u, 0.13 * u, (z + 0.06) * u]}
                scale={[0.17 * u, 0.2 * u, 0.2 * u]}
                color={tones.shadow}
              />
              <Part
                position={[s * 0.27 * u, 0.055 * u, (z + 0.2) * u]}
                scale={[0.28 * u, 0.1 * u, 0.34 * u]}
                color={body}
              />
              {[-1, 0, 1].map((c) => (
                <Spike
                  key={c}
                  position={[(s * 0.27 + c * 0.07) * u, 0.05 * u, (z + 0.39) * u]}
                  rotation={[Math.PI / 2, 0, 0]}
                  size={[0.02 * u, 0.12 * u, 4]}
                  color={accent}
                />
              ))}
            </group>
          )),
        )}
        {/* Segmented tail; Chimera ends in a rune blade, Jackal in a storm fork. */}
        {[0, 1, 2, 3].map((i) => (
          <Part
            key={`tail-${i}`}
            position={[Math.sin(i * 0.55) * 0.18 * u, (0.76 + i * 0.09) * u, (-0.78 - i * 0.27) * u]}
            scale={[(0.2 - i * 0.025) * u, (0.2 - i * 0.025) * u, 0.34 * u]}
            rotation={[-0.28, 0, -Math.sin(i * 0.55) * 0.28]}
            color={i % 2 ? accent : body}
            metalness={i % 2 ? 0.58 : 0.2}
          />
        ))}
        {chimera ? (
          <Spike
            position={[0.18 * u, 1.05 * u, -1.86 * u]}
            rotation={[Math.PI / 2, 0, 0.28]}
            size={[0.1 * u, 0.4 * u, 4]}
            color={accent}
            glow={glow * 0.45}
          />
        ) : (
          <group>
            {[-1, 1].map((s) => (
              <Spike
                key={`fork-${s}`}
                position={[(0.18 + s * 0.08) * u, 1.03 * u, -1.84 * u]}
                rotation={[Math.PI / 2, 0, s * 0.25]}
                size={[0.055 * u, 0.3 * u, 4]}
                color={accent}
                glow={glow * 0.55}
              />
            ))}
          </group>
        )}
      </group>
    );
  }

  return (
    <group ref={root} raycast={noRaycast}>
      <group ref={motion}>{creature}</group>
      <RarityRegalia rarity={rarity} accent={accent} u={u} glow={glow} />
      <EnergyAura rarity={rarity} accent={accent} u={u} glow={glow} />
    </group>
  );
});
/**
 * Collection body: when the home block is known, the Guardian wears its own
 * procedural design grown from that block's DNA; until then its species body.
 */
export function GuardianBody(props: {
  species: GuardianSpecies;
  rarity: GuardianRarity;
  body: string;
  accent: string;
  unit?: number;
  height?: number | undefined;
  /** Verified on-chain child inscription: adds the inscribed seal. */
  inscribed?: boolean;
}) {
  const { height, inscribed, ...rest } = props;
  const dna = useQuery({ ...guardianDnaQuery(height ?? 0), enabled: height != null, staleTime: Infinity });
  const morph = useMemo(() => (dna.data ? morphFromDna(dna.data) : null), [dna.data]);
  const u = (rest.unit ?? 1) * 1.1;
  if (height != null && morph && dna.data) {
    return (
      <group>
        {ONCHAIN_STYLE ? <OnchainGuardianBody dna={dna.data} unit={u} /> : <MorphBody m={morph} unit={u} rarity={rest.rarity} />}
        {inscribed ? <InscribedSeal color={morph.glow} u={u} /> : null}
      </group>
    );
  }
  return <SpeciesBody {...rest} />;
}

/** Orange ground sigil + slow orbiting ring marking an on-chain inscribed Guardian. */
function InscribedSeal({ color, u }: { color: string; u: number }) {
  const ring = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const r = ring.current;
    if (r) { r.rotation.y = clock.elapsedTime * 0.6; r.position.y = 1.5 * u + Math.sin(clock.elapsedTime * 1.4) * 0.05 * u; }
  });
  return (
    <group raycast={noRaycast}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015 * u, 0]} raycast={noRaycast}>
        <ringGeometry args={[0.95 * u, 1.05 * u, 4, 1]} />
        <meshBasicMaterial color="#f7931a" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <group ref={ring}>
        <mesh rotation-x={Math.PI / 2} raycast={noRaycast}>
          <torusGeometry args={[0.32 * u, 0.02 * u, 4, 16]} />
          <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={1.8} />
        </mesh>
        <mesh raycast={noRaycast}>
          <octahedronGeometry args={[0.08 * u, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
        </mesh>
      </group>
    </group>
  );
}
