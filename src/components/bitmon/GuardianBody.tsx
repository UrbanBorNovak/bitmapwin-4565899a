/** Premium procedural Guardian bodies, built only from species and block-derived colours. */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { morphFromDna } from "@/lib/creature-morph";
import { MorphBody } from "@/components/bitmon/MorphBody";
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
        transparent={opacity < 1}
        opacity={opacity}
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
  metalness = 0.56,
}: {
  position: Vec3;
  rotation?: Vec3;
  size: Vec3;
  color: string;
  glow?: number;
  metalness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow raycast={noRaycast}>
      <coneGeometry args={[size[0], size[1], Math.max(4, Math.round(size[2]))]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow}
        metalness={metalness}
        roughness={0.34}
        flatShading
      />
    </mesh>
  );
}

function Gem({ position, scale, color, glow }: { position: Vec3; scale: number; color: string; glow: number }) {
  return (
    <mesh position={position} castShadow raycast={noRaycast}>
      <octahedronGeometry args={[scale, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow + 0.55}
        metalness={0.78}
        roughness={0.16}
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
  const points = rarity === "MYTHIC" ? 10 : rarity === "EPIC" ? 7 : 5;
  const haloR = rarity === "MYTHIC" ? 0.84 : rarity === "EPIC" ? 0.74 : 0.66;
  return (
    <group raycast={noRaycast}>
      {Array.from({ length: points }, (_, i) => {
        const angle = (i / points) * Math.PI * 2;
        const radius = haloR * u;
        const tall = rarity === "MYTHIC" ? 0.28 : rarity === "EPIC" ? 0.2 : 0.14;
        return (
          <group key={i} position={[Math.sin(angle) * radius, 1.22 * u, Math.cos(angle) * radius]} rotation-y={angle}>
            <Part
              position={[0, 0, 0]}
              scale={[0.048 * u, tall * u, 0.048 * u]}
              rotation={[0, 0, i % 2 ? 0.42 : -0.42]}
              color={accent}
              metalness={0.78}
              roughness={0.16}
              glow={glow * 0.55}
            />
            {rarity === "MYTHIC" || rarity === "EPIC" ? (
              <Gem position={[0, tall * 0.55 * u, 0]} scale={0.028 * u} color={accent} glow={glow} />
            ) : null}
          </group>
        );
      })}
      {rarity === "MYTHIC" ? (
        <>
          <mesh position={[0, 1.26 * u, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
            <torusGeometry args={[0.9 * u, 0.016 * u, 4, 28]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={glow}
              transparent
              opacity={0.78}
            />
          </mesh>
          <mesh position={[0, 1.34 * u, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
            <torusGeometry args={[0.62 * u, 0.012 * u, 4, 22]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={glow * 0.7}
              transparent
              opacity={0.55}
            />
          </mesh>
        </>
      ) : rarity === "EPIC" ? (
        <mesh position={[0, 1.24 * u, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
          <torusGeometry args={[0.78 * u, 0.014 * u, 4, 20]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={glow * 0.75}
            transparent
            opacity={0.5}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function EnergyAura({ rarity, accent, u, glow }: { rarity: GuardianRarity; accent: string; u: number; glow: number }) {
  const motes = useRef<THREE.Group>(null);
  const count = rarity === "MYTHIC" ? 14 : rarity === "EPIC" ? 9 : rarity === "RARE" ? 5 : 0;
  useFrame(({ clock }) => {
    if (!motes.current) return;
    const t = clock.elapsedTime;
    motes.current.rotation.y = t * 0.38;
    motes.current.children.forEach((child, i) => {
      child.position.y = (0.28 + Math.sin(t * 1.6 + i * 0.7) * 0.32 + (i % 5) * 0.05) * u;
      const s = 0.62 + (Math.sin(t * 3.1 + i * 1.4) + 1) * 0.38;
      child.scale.setScalar(s);
    });
  });
  if (rarity === "COMMON") return null;
  return (
    <group raycast={noRaycast}>
      <mesh position={[0, 0.01 * u, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
        <circleGeometry args={[(rarity === "MYTHIC" ? 1.28 : 1.02) * u, 36]} />
        <meshBasicMaterial color={accent} transparent opacity={0.08 + glow * 0.05} depthWrite={false} />
      </mesh>
      {rarity === "MYTHIC" ? (
        <mesh position={[0, 0.014 * u, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
          <ringGeometry args={[0.72 * u, 1.05 * u, 36]} />
          <meshBasicMaterial color={accent} transparent opacity={0.09} depthWrite={false} />
        </mesh>
      ) : null}
      <group ref={motes}>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / Math.max(1, count)) * Math.PI * 2;
          const radius = (0.55 + (i % 4) * 0.16) * u;
          return (
            <mesh key={i} position={[Math.sin(angle) * radius, 0.48 * u, Math.cos(angle) * radius]} raycast={noRaycast}>
              <octahedronGeometry args={[0.028 * u, 0]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={glow + 1.05}
                transparent
                opacity={0.88}
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
      <Part position={position} scale={scale} color={accent} metalness={0.28} roughness={0.16} glow={glow + 0.85} />
      <Part
        position={[position[0], position[1], position[2] + scale[2] * 0.35]}
        scale={[scale[0] * 0.38, scale[1] * 0.38, scale[2] * 0.4]}
        color={tones.gleam}
        metalness={0.2}
        roughness={0.12}
        glow={glow + 1.1}
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
      glow={glow * 0.78}
    />
  );
  const plate = (position: Vec3, scale: Vec3, rotation?: Vec3, lit = false) => (
    <Part
      position={position}
      scale={scale}
      {...(rotation ? { rotation } : {})}
      color={lit ? accent : tones.mid}
      metalness={lit ? 0.7 : 0.42}
      roughness={lit ? 0.22 : 0.4}
      glow={lit ? glow * 0.22 : 0}
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
          metalness={obsidian ? 0.48 : 0.3}
        />
        <Part
          position={[0, 1.02 * u, 0]}
          scale={[1.08 * u, 0.18 * u, 0.74 * u]}
          color={tones.shadow}
          metalness={0.55}
        />
        <Part
          position={[0, 1.22 * u, -0.36 * u]}
          scale={[0.68 * u, 0.6 * u, 0.14 * u]}
          color={tones.deep}
          metalness={0.6}
          roughness={0.3}
        />
        {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
          <Part
            key={`spine-${i}`}
            position={[x * 0.16 * u, 1.46 * u, -0.4 * u]}
            scale={[0.14 * u, 0.12 * u, 0.18 * u]}
            rotation={[0.22, 0, x * 0.08]}
            color={i === 1 || i === 2 ? accent : tones.mid}
            metalness={0.7}
            glow={i === 1 || i === 2 ? glow * 0.45 : 0}
          />
        ))}
        <Part
          position={[0, 1.14 * u, 0.34 * u]}
          scale={[0.66 * u, 0.48 * u, 0.06 * u]}
          color={tones.shadow}
          metalness={0.74}
          roughness={0.22}
        />
        {[-1, 1].map((s) => (
          <Part
            key={`pect-${s}`}
            position={[s * 0.2 * u, 1.2 * u, 0.38 * u]}
            scale={[0.26 * u, 0.34 * u, 0.05 * u]}
            rotation={[0, 0, s * 0.1]}
            color={tones.light}
            metalness={0.52}
          />
        ))}
        {rune([0, 1.08 * u, 0.41 * u], [0.15 * u, 0.15 * u, 0.03 * u], [0, 0, Math.PI / 4])}
        <Gem position={[0, 1.08 * u, 0.44 * u]} scale={0.045 * u} color={accent} glow={glow} />
        {[-1, 1].map((s) => (
          <group key={`vent-${s}`}>
            <Part
              position={[s * 0.32 * u, 0.9 * u, 0.4 * u]}
              scale={[0.12 * u, 0.04 * u, 0.03 * u]}
              color={accent}
              glow={glow * 0.5}
            />
            <Part
              position={[s * 0.32 * u, 0.82 * u, 0.4 * u]}
              scale={[0.09 * u, 0.025 * u, 0.025 * u]}
              color={tones.gleam}
              glow={glow * 0.3}
            />
          </group>
        ))}

        <Part position={[0, 1.72 * u, 0.02 * u]} scale={[0.6 * u, 0.48 * u, 0.52 * u]} color={body} />
        <Part
          position={[0, 1.94 * u, -0.02 * u]}
          scale={[0.48 * u, 0.14 * u, 0.4 * u]}
          color={tones.light}
          metalness={0.66}
        />
        <Part
          position={[0, 1.6 * u, 0.3 * u]}
          scale={[0.36 * u, 0.1 * u, 0.09 * u]}
          color={tones.deep}
          metalness={0.5}
        />
        <Part position={[0, 1.48 * u, 0.22 * u]} scale={[0.22 * u, 0.08 * u, 0.16 * u]} color={tones.shadow} />
        {[-1, 1].map((s) => (
          <group key={`face-${s}`}>
            {eye([s * 0.14 * u, 1.74 * u, 0.29 * u], [0.1 * u, 0.058 * u, 0.038 * u])}
            <Part
              position={[s * 0.24 * u, 1.56 * u, 0.26 * u]}
              scale={[0.14 * u, 0.2 * u, 0.09 * u]}
              rotation={[0, 0, s * 0.14]}
              color={tones.mid}
              metalness={0.58}
            />
            <Part
              position={[s * 0.28 * u, 1.78 * u, 0.08 * u]}
              scale={[0.08 * u, 0.22 * u, 0.22 * u]}
              rotation={[0, 0, s * 0.18]}
              color={tones.shadow}
              metalness={0.5}
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
              glow={glow * 0.4}
            />
          ))
        ) : (
          <group>
            <Part
              position={[0, 2.04 * u, 0]}
              scale={[0.18 * u, 0.16 * u, 0.36 * u]}
              color={accent}
              metalness={0.76}
              glow={glow * 0.35}
            />
            <Gem position={[0, 2.16 * u, 0]} scale={0.05 * u} color={accent} glow={glow} />
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
              metalness={0.74}
              roughness={0.22}
              glow={glow * 0.12}
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
                glow={glow * 0.32}
              />
            ) : null}
            <Part
              position={[s * 0.68 * u, 1.05 * u, 0]}
              scale={[0.24 * u, 0.48 * u, 0.28 * u]}
              color={tones.shadow}
              metalness={0.48}
            />
            <Part
              position={[s * 0.68 * u, 1.08 * u, 0.16 * u]}
              scale={[0.1 * u, 0.32 * u, 0.06 * u]}
              color={accent}
              glow={glow * 0.18}
            />
            <Part
              position={[s * 0.68 * u, 0.82 * u, 0.02 * u]}
              scale={[0.3 * u, 0.16 * u, 0.34 * u]}
              color={accent}
              metalness={0.74}
              glow={glow * 0.22}
            />
            <Part position={[s * 0.68 * u, 0.56 * u, 0.12 * u]} scale={[0.4 * u, 0.36 * u, 0.44 * u]} color={body} />
            {[-1.2, 0, 1.2].map((f) => (
              <Part
                key={`finger-${f}`}
                position={[(s * 0.68 + f * 0.09) * u, 0.4 * u, 0.34 * u]}
                scale={[0.07 * u, 0.16 * u, 0.2 * u]}
                color={tones.light}
                metalness={0.42}
              />
            ))}
            <Spike
              position={[s * 0.68 * u, 0.38 * u, 0.48 * u]}
              rotation={[Math.PI / 2, 0, 0]}
              size={[0.035 * u, 0.16 * u, 4]}
              color={accent}
              glow={glow * 0.15}
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
              metalness={0.7}
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
                  metalness={0.72}
                  glow={glow * 0.14}
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
            emissiveIntensity={0.28 + glow * 0.55}
            roughness={0.16}
            metalness={0.14}
            transparent
            opacity={0.8}
            clearcoat={0.78}
          />
        </mesh>
        <mesh position={[0, 1.22 * u, 0]} raycast={noRaycast}>
          <icosahedronGeometry args={[0.32 * u, 0]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.6 + glow}
            transparent
            opacity={0.55}
          />
        </mesh>
        <Part
          position={[0, 1.54 * u, -0.08 * u]}
          scale={[0.72 * u, 0.2 * u, 0.56 * u]}
          color={tones.deep}
          metalness={0.48}
        />
        {[-1, 1].map((s) => (
          <Part
            key={`hood-${s}`}
            position={[s * 0.3 * u, 1.3 * u, 0.04 * u]}
            scale={[0.22 * u, 0.54 * u, 0.52 * u]}
            rotation={[0, 0, s * 0.2]}
            color={tones.shadow}
            metalness={0.4}
          />
        ))}
        <Part
          position={[0, 1.06 * u, 0.38 * u]}
          scale={[0.42 * u, 0.38 * u, 0.08 * u]}
          color={tones.shadow}
          metalness={0.52}
        />
        {[-1, 1].map((s) => eye([s * 0.11 * u, 1.22 * u, 0.44 * u], [0.08 * u, 0.048 * u, 0.028 * u]))}
        {rune([0, 1.02 * u, 0.44 * u], [0.06 * u, 0.16 * u, 0.028 * u])}
        <mesh position={[0, 1.22 * u, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <torusGeometry args={[0.58 * u, 0.022 * u, 4, 16]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={glow} metalness={0.62} />
        </mesh>
        <mesh position={[0, 1.22 * u, 0]} rotation={[0, Math.PI / 4, Math.PI / 3]} raycast={noRaycast}>
          <torusGeometry args={[0.74 * u, 0.016 * u, 4, 16]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={glow * 0.75}
            transparent
            opacity={0.72}
          />
        </mesh>
        <mesh position={[0, 1.22 * u, 0]} rotation={[Math.PI / 5, -Math.PI / 6, 0]} raycast={noRaycast}>
          <torusGeometry args={[0.86 * u, 0.012 * u, 4, 18]} />
          <meshStandardMaterial
            color={tones.gleam}
            emissive={accent}
            emissiveIntensity={glow * 0.45}
            transparent
            opacity={0.45}
          />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={`hand-${s}`} position={[s * 0.76 * u, 0.94 * u, 0.1 * u]} rotation-z={-s * 0.28}>
            <Part position={[0, 0, 0]} scale={[0.26 * u, 0.22 * u, 0.3 * u]} color={tones.mid} metalness={0.55} />
            <Part
              position={[0, 0.08 * u, 0]}
              scale={[0.3 * u, 0.06 * u, 0.34 * u]}
              color={accent}
              metalness={0.7}
              glow={glow * 0.2}
            />
            {[-1, 0, 1].map((f) => (
              <Part
                key={f}
                position={[f * 0.075 * u, -0.14 * u, 0.13 * u]}
                scale={[0.05 * u, 0.2 * u, 0.06 * u]}
                color={accent}
                glow={glow * 0.4}
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
              glow={i % 2 ? glow * 0.35 : 0}
            />
          );
        })}
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
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={glow * 0.85}
                metalness={0.68}
                roughness={0.18}
              />
            </mesh>
          );
        })}
      </group>
    );
  } else if (shape === "bird") {
    creature = (
      <group>
        <Part position={[0, 0.82 * u, -0.1 * u]} scale={[0.54 * u, 0.56 * u, 1.12 * u]} color={body} />
        <Part position={[0, 0.62 * u, -0.08 * u]} scale={[0.46 * u, 0.22 * u, 0.86 * u]} color={tones.shadow} />
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
        <Part position={[0, 1.3 * u, 0.5 * u]} scale={[0.44 * u, 0.44 * u, 0.44 * u]} color={body} />
        <Part position={[0, 1.24 * u, 0.8 * u]} scale={[0.3 * u, 0.22 * u, 0.3 * u]} color={tones.light} />
        <Spike
          position={[0, 1.2 * u, 1.02 * u]}
          rotation={[Math.PI / 2, 0, 0]}
          size={[0.11 * u, 0.38 * u, 5]}
          color={accent}
          glow={glow * 0.28}
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
              metalness={0.62}
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
            glow={i % 2 ? glow * 0.28 : 0}
          />
        ))}
        {[-1, 1].map((s) => (
          <group key={`wing-${s}`} rotation-z={s * 0.08}>
            <Part
              position={[s * 0.56 * u, 1.04 * u, -0.04 * u]}
              scale={[0.66 * u, 0.12 * u, 0.74 * u]}
              rotation={[0, s * 0.08, s * 0.26]}
              color={accent}
              metalness={0.54}
              glow={glow * 0.2}
            />
            {[0, 1, 2, 3, 4, 5].map((f) => (
              <Part
                key={`primary-${f}`}
                position={[s * (0.74 + f * 0.175) * u, (0.98 - f * 0.055) * u, (-0.12 - f * 0.09) * u]}
                scale={[(0.42 - f * 0.03) * u, 0.042 * u, 0.15 * u]}
                rotation={[0, s * (0.1 + f * 0.03), s * (0.32 + f * 0.04)]}
                color={f % 2 ? tones.light : body}
                metalness={0.26}
              />
            ))}
            {[0, 1, 2, 3].map((f) => (
              <Part
                key={`covert-${f}`}
                position={[s * (0.48 + f * 0.16) * u, (1.13 - f * 0.02) * u, (0.18 - f * 0.12) * u]}
                scale={[0.32 * u, 0.06 * u, 0.18 * u]}
                rotation={[0, s * 0.08, s * (0.18 + f * 0.045)]}
                color={f === 1 ? accent : tones.mid}
                metalness={0.44}
                glow={f === 1 ? glow * 0.14 : 0}
              />
            ))}
          </group>
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
            metalness={i === 1 || i === 2 ? 0.52 : 0.18}
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
              metalness={cyber ? 0.8 : 0.36}
              glow={cyber ? glow * 0.18 : 0}
            />
            {[-1, 1].map((s) => (
              <Part
                key={`rib-${s}`}
                position={[s * 0.28 * u, 0.7 * u, z * u]}
                scale={[0.06 * u, 0.22 * u, 0.18 * u]}
                color={tones.shadow}
              />
            ))}
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
              metalness={0.72}
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
            glow={glow * 0.28}
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
                metalness={0.84}
                glow={glow * 0.45}
              />
            ))}
            {rune([0, 0.84 * u, 1.58 * u], [0.12 * u, 0.036 * u, 0.028 * u])}
            <Gem position={[0, 0.92 * u, 1.18 * u]} scale={0.04 * u} color={accent} glow={glow} />
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
                metalness={0.7}
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
          glow={glow * 0.26}
        />
        {[-0.7, -0.28, 0.14, 0.56, 0.92].map((z, i) => (
          <Spike
            key={`dorsal-${z}`}
            position={[0, 1.08 * u, z * u]}
            rotation={[0.12, 0, 0]}
            size={[(0.055 + i * 0.008) * u, (0.22 + i * 0.03) * u, 4]}
            color={cyber ? accent : tones.light}
            glow={cyber ? glow * 0.24 : 0}
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
          metalness={0.36}
        />
        <Part position={[0, 0.58 * u, 0.02 * u]} scale={[0.48 * u, 0.16 * u, 0.9 * u]} color={tones.shadow} />
        {[-1, 1].map((s) => (
          <group key={`shoulder-${s}`}>
            <Part
              position={[s * 0.36 * u, 0.94 * u, 0.3 * u]}
              scale={[0.26 * u, 0.26 * u, 0.44 * u]}
              rotation={[0, 0, s * 0.16]}
              color={accent}
              metalness={0.7}
              glow={glow * 0.16}
            />
            <Part
              position={[s * 0.42 * u, 1.08 * u, 0.22 * u]}
              scale={[0.1 * u, 0.16 * u, 0.22 * u]}
              rotation={[0, 0, s * 0.2]}
              color={tones.gleam}
              metalness={0.6}
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
            metalness={0.56}
            glow={i === 1 || i === 2 ? glow * 0.2 : 0}
          />
        ))}
        <Part position={[0, 1.2 * u, 0.6 * u]} scale={[0.5 * u, 0.5 * u, 0.52 * u]} color={body} />
        <Part position={[0, 1.1 * u, 0.96 * u]} scale={[0.36 * u, 0.26 * u, 0.44 * u]} color={tones.light} />
        <Part
          position={[0, 1.1 * u, 1.22 * u]}
          scale={[0.24 * u, 0.16 * u, 0.14 * u]}
          color={tones.deep}
          metalness={0.42}
        />
        {[-1, 1].map((s) => (
          <group key={`beast-face-${s}`}>
            {eye([s * 0.15 * u, 1.32 * u, 0.86 * u])}
            <Part
              position={[s * 0.24 * u, 1.2 * u, 0.74 * u]}
              scale={[0.14 * u, 0.24 * u, 0.13 * u]}
              rotation={[0, 0, s * 0.16]}
              color={accent}
              metalness={0.64}
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
              glow={glow * 0.2}
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
                glow={glow * 0.3}
              />
            ))}
            {rune([0, 1.44 * u, 0.78 * u], [0.1 * u, 0.1 * u, 0.028 * u], [0, 0, Math.PI / 4])}
            <Gem position={[0, 1.44 * u, 0.82 * u]} scale={0.038 * u} color={accent} glow={glow} />
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
                glow={glow * 0.58}
              />
            ))}
            <Part
              position={[0, 1.36 * u, 0.52 * u]}
              scale={[0.16 * u, 0.06 * u, 0.08 * u]}
              color={accent}
              glow={glow * 0.35}
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
                metalness={0.68}
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
            metalness={i % 2 ? 0.6 : 0.2}
          />
        ))}
        {chimera ? (
          <Spike
            position={[0.2 * u, 1.1 * u, -1.96 * u]}
            rotation={[Math.PI / 2, 0, 0.28]}
            size={[0.1 * u, 0.44 * u, 5]}
            color={accent}
            glow={glow * 0.48}
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
                glow={glow * 0.58}
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
