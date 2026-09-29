/** Renders a procedural CreatureMorph genome as an animated voxel body. */
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CreatureMorph } from "@/lib/creature-morph";

type Vec3 = [number, number, number];
const noRay = () => {};

function Box({ p, s, r, c, g = 0, m = 0.2 }: { p: Vec3; s: Vec3; r?: Vec3; c: string; g?: number; m?: number }) {
  return (
    <mesh position={p} {...(r ? { rotation: r } : {})} castShadow raycast={noRay}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={g} metalness={m} roughness={0.55} flatShading />
    </mesh>
  );
}
function Cone({ p, r = [0, 0, 0], w, h, c, g = 0 }: { p: Vec3; r?: Vec3; w: number; h: number; c: string; g?: number }) {
  return (
    <mesh position={p} rotation={r} castShadow raycast={noRay}>
      <coneGeometry args={[w, h, 5]} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={g} metalness={0.5} roughness={0.35} flatShading />
    </mesh>
  );
}

export const MorphBody = memo(function MorphBody({ m, unit = 1 }: { m: CreatureMorph; unit?: number }) {
  const u = unit;
  const legs = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Group | null)[]>([]);
  const tail = useRef<(THREE.Group | null)[]>([]);
  const segs = useRef<(THREE.Group | null)[]>([]);
  const bob = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * m.gait;
    legs.current.forEach((g, i) => g && (g.rotation.x = Math.sin(t * 2 + (i % 2 ? Math.PI : 0) + Math.floor(i / 2) * 1.1) * 0.45));
    wings.current.forEach((g, i) => g && (g.rotation.z = (i % 2 ? -1 : 1) * (0.25 + Math.sin(t * 3 + i) * 0.5)));
    tail.current.forEach((g, i) => g && (g.rotation.y = Math.sin(t * 1.4 - i * 0.6) * 0.25));
    segs.current.forEach((g, i) => g && (g.position.x = Math.sin(t * 1.6 - i * 0.8) * 0.08 * u));
    if (bob.current) bob.current.position.y = (m.plan === "FLOATER" ? Math.sin(t) * 0.12 : Math.abs(Math.sin(t * 2)) * 0.02) * u;
  });

  const { primary: P, secondary: S, glow: G } = m;
  const floor = m.plan === "SERPENT" ? m.bodyTall * 0.5 : m.plan === "FLOATER" ? 0.9 : m.legLen + m.bodyTall * 0.5;
  const upright = m.plan === "BIPED" || m.plan === "AVIAN";
  const L = m.bodyLen * u, W = m.bodyWide * u, T = m.bodyTall * u;
  const bodyY = floor * u;
  const segLen = m.plan === "SERPENT" ? L / 2.2 : L / m.segments;

  // Torso segments (serpent chains them backwards).
  const torso = Array.from({ length: m.segments }, (_, i) => {
    const z = m.plan === "SERPENT" ? -i * segLen * 0.9 : (i - (m.segments - 1) / 2) * segLen;
    const taper = m.plan === "SERPENT" ? 1 - i / (m.segments * 1.6) : 1;
    return (
      <group key={`s${i}`} ref={(g) => { segs.current[i] = m.plan === "SERPENT" ? g : null; }} position={[0, 0, z]}>
        <Box p={[0, 0, 0]} s={[W * taper, T * taper, segLen * 0.95]} c={P} />
        {m.pattern === "STRIPES" && <Box p={[0, T * taper * 0.51, 0]} s={[W * taper * 0.9, 0.02 * u, segLen * 0.25]} c={S} />}
        {m.pattern === "PLATES" && <Box p={[0, T * taper * 0.52, 0]} s={[W * taper * 0.7, 0.06 * u, segLen * 0.7]} c={S} m={0.6} />}
        {m.pattern === "SPOTS" && <Box p={[W * taper * 0.51, 0, 0]} s={[0.02 * u, T * 0.3, T * 0.3]} c={S} />}
        {m.pattern === "CIRCUIT" && <Box p={[0, T * taper * 0.505, 0]} s={[0.03 * u, 0.01 * u, segLen * 0.9]} c={G} g={1.2} />}
      </group>
    );
  });

  const headZ = m.plan === "SERPENT" ? segLen * 0.7 : L / 2 + m.neckLen * u + m.headSize * u * 0.4;
  const headY = (upright ? T * 1.1 : m.plan === "CENTAUR" ? T * 1.4 : T * 0.25) + m.neckLen * u * 0.5;
  const H = m.headSize * u;

  const eyes = Array.from({ length: m.eyes }, (_, i) => {
    const cols = Math.min(m.eyes, 3);
    const x = ((i % cols) - (cols - 1) / 2) * H * 0.3;
    const y = H * 0.12 + Math.floor(i / cols) * H * 0.18;
    return <Box key={`e${i}`} p={[x, y, H * 0.5]} s={[H * 0.14, H * 0.12, 0.02 * u]} c={G} g={2} />;
  });

  const horns = Array.from({ length: m.hornCount }, (_, i) => {
    const side = m.horns === "CROWN" ? (i - 2) * 0.35 : i ? 1 : -1;
    const tilt: Vec3 = m.horns === "CURL" ? [-0.9, 0, side * 0.9] : m.horns === "ANTLER" ? [-0.3, 0, side * 0.6] : [-0.3, 0, side * 0.25];
    const x = m.horns === "CROWN" ? side * H * 0.6 : side * H * 0.32;
    return (
      <group key={`h${i}`} position={[x, H * 0.5, 0]} rotation={tilt}>
        <Cone p={[0, H * 0.3, 0]} w={H * 0.08} h={H * (m.horns === "ANTLER" ? 0.9 : 0.6)} c={m.horns === "CROWN" ? G : S} g={m.horns === "CROWN" ? 0.8 : 0} />
        {m.horns === "ANTLER" && <Cone p={[H * 0.12, H * 0.4, 0]} r={[0, 0, -0.8]} w={H * 0.05} h={H * 0.4} c={S} />}
      </group>
    );
  });

  const legNodes: React.ReactNode[] = [];
  for (let pair = 0; pair < m.legPairs; pair++) {
    const z = m.legPairs === 1 ? 0 : (pair / (m.legPairs - 1) - 0.5) * L * 0.85;
    for (const side of [-1, 1]) {
      const i = pair * 2 + (side > 0 ? 1 : 0);
      const spread = m.plan === "ARACHNID" || m.plan === "HEXAPOD" ? 0.7 : 0;
      legNodes.push(
        <group key={`l${i}`} position={[side * W * 0.5, -T * 0.3, z]} rotation={[0, 0, side * spread]} ref={(g) => { legs.current[i] = g; }}>
          <Box p={[0, -m.legLen * u * 0.35, 0]} s={[0.1 * u, m.legLen * u * 0.7, 0.1 * u]} c={P} />
          <Box p={[0, -m.legLen * u * 0.85, 0.02 * u]} s={[0.08 * u, m.legLen * u * 0.35, 0.08 * u]} c={S} />
          <Box p={[0, -m.legLen * u - 0.01 * u, 0.04 * u]} s={[0.12 * u, 0.04 * u, 0.16 * u]} c={S} />
        </group>,
      );
    }
  }

  const wingNodes = Array.from({ length: m.wings }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const z = i < 2 ? L * 0.1 : -L * 0.25;
    const span = m.wingSpan * u * (i < 2 ? 1 : 0.7);
    return (
      <group key={`w${i}`} position={[side * W * 0.45, T * 0.4, z]} ref={(g) => { wings.current[i] = g; }}>
        <Box p={[side * span * 0.5, 0, 0]} s={[span, 0.03 * u, L * 0.45]} c={S} />
        <Box p={[side * span * 0.5, 0.02 * u, -L * 0.05]} s={[span * 0.9, 0.02 * u, 0.04 * u]} c={G} g={0.6} />
      </group>
    );
  });

  const tailNodes = Array.from({ length: m.tailSegs }, (_, i) => {
    const s = 1 - i / (m.tailSegs + 2);
    const back = m.plan === "SERPENT" ? -(m.segments - 1) * segLen * 0.9 - segLen * 0.6 : -L / 2;
    return (
      <group key={`t${i}`} ref={(g) => { tail.current[i] = g; }} position={[0, m.plan === "FLOATER" ? -T * 0.6 - i * 0.12 * u : T * 0.1, back - i * 0.12 * u]}>
        <Box p={[0, 0, -0.06 * u]} s={[0.12 * u * s, 0.12 * u * s, 0.13 * u]} c={i === m.tailSegs - 1 ? G : P} g={i === m.tailSegs - 1 ? 1 : 0} />
      </group>
    );
  });

  const spineNodes = Array.from({ length: m.spines }, (_, i) => (
    <Cone key={`p${i}`} p={[0, T * 0.5 + 0.06 * u, L * 0.4 - (i / Math.max(1, m.spines - 1)) * L * 0.8]} w={0.05 * u} h={0.16 * u} c={G} g={0.5} />
  ));

  return (
    <group ref={bob}>
      <group position={[0, bodyY, 0]} rotation={[upright ? -0.9 : 0, 0, 0]}>
        {torso}
        {legNodes.length && !upright ? legNodes : null}
        {wingNodes}
        {tailNodes}
        {spineNodes}
        {m.plan === "FLOATER" && <Box p={[0, T * 0.3, 0]} s={[W * 0.4, W * 0.4, W * 0.4]} r={[0.6, 0.6, 0]} c={G} g={1.6} />}
      </group>
      {upright && (
        <group position={[0, m.legLen * u, 0]}>
          {legNodes}
        </group>
      )}
      <group position={[0, bodyY + headY, upright ? L * 0.1 : headZ]}>
        <Box p={[0, 0, 0]} s={[H, H * 0.8, H]} c={P} />
        <Box p={[0, -H * 0.25, H * 0.45]} s={[H * 0.7, H * 0.25, H * 0.4]} c={S} />
        {m.plan === "AVIAN" && <Cone p={[0, -H * 0.05, H * 0.75]} r={[Math.PI / 2, 0, 0]} w={H * 0.14} h={H * 0.45} c="#e0b050" />}
        {eyes}
        {horns}
      </group>
      {m.plan === "CENTAUR" && <Box p={[0, bodyY + T * 0.9, L * 0.35]} s={[W * 0.7, T * 1.2, W * 0.5]} c={P} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} raycast={noRay}>
        <circleGeometry args={[Math.max(L, W) * 0.9, 32]} />
        <meshBasicMaterial color={G} transparent opacity={0.12} />
      </mesh>
    </group>
  );
});
