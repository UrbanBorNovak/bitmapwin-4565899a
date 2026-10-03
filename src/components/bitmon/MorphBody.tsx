/** Renders a block-derived CreatureMorph as a detailed animated voxel collectible. */
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GuardianRarity } from "@/lib/bitmon";
import type { CreatureMorph } from "@/lib/creature-morph";

type Vec3 = [number, number, number];
const noRay = () => {};

function Box({ p, s, r, c, g = 0, m = 0.2, rough = 0.55 }: { p: Vec3; s: Vec3; r?: Vec3; c: string; g?: number; m?: number; rough?: number }) {
  return (
    <mesh position={p} {...(r ? { rotation: r } : {})} castShadow receiveShadow raycast={noRay}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={g} metalness={m} roughness={rough} flatShading />
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

function Joint({ p, c, u }: { p: Vec3; c: string; u: number }) {
  return (
    <mesh position={p} castShadow raycast={noRay}>
      <octahedronGeometry args={[0.095 * u, 0]} />
      <meshStandardMaterial color={c} metalness={0.68} roughness={0.3} flatShading />
    </mesh>
  );
}

function Sigil({ p, r, c, u, glow = 0.9 }: { p: Vec3; r?: Vec3; c: string; u: number; glow?: number }) {
  return (
    <group position={p} {...(r ? { rotation: r } : {})}>
      <Box p={[0, 0, 0]} s={[0.035 * u, 0.19 * u, 0.018 * u]} c={c} g={glow} m={0.7} rough={0.2} />
      <Box p={[0, 0, 0]} s={[0.19 * u, 0.035 * u, 0.02 * u]} c={c} g={glow} m={0.7} rough={0.2} />
    </group>
  );
}


/** Every 4 s: lightning arcs over the body, a rune overcharge and a DNA mutation shimmer. */
export const SURGE_PERIOD = 4;
function DnaSurge({ host, span, top, glow, accent }: { host: React.RefObject<THREE.Group | null>; span: number; top: number; glow: string; accent: string }) {
  const bolts = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);
  const ring = useRef<THREE.Mesh>(null);
  const lastCycle = useRef(-1);
  const lines = useMemo(() => Array.from({ length: 4 }, (_, i) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
    const mat = new THREE.LineBasicMaterial({ color: i % 2 ? accent : glow, transparent: true, opacity: 0, depthWrite: false });
    return new THREE.Line(g, mat);
  }), [glow, accent]);
  useEffect(() => () => lines.forEach((l) => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); }), [lines]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const cycle = Math.floor(t / SURGE_PERIOD);
    const phase = t - cycle * SURGE_PERIOD; // 0..4
    const k = phase < 0.6 ? 1 - phase / 0.6 : 0; // surge envelope
    if (cycle !== lastCycle.current) {
      lastCycle.current = cycle;
      // regrow each bolt: jagged path from above the crest down to the pedestal
      lines.forEach((l, i) => {
        const a = (l.geometry.getAttribute("position") as THREE.BufferAttribute);
        const ang = Math.random() * Math.PI * 2;
        const sx = Math.cos(ang) * span * 0.3, sz = Math.sin(ang) * span * 0.3;
        const ex = Math.cos(ang + 1 + i) * span * 0.9, ez = Math.sin(ang + 1 + i) * span * 0.9;
        for (let j = 0; j < 10; j++) {
          const f = j / 9;
          const jit = j === 0 || j === 9 ? 0 : (Math.random() - 0.5) * span * 0.35;
          a.setXYZ(j, sx + (ex - sx) * f + jit, top * 1.25 * (1 - f) + 0.02, sz + (ez - sz) * f + jit);
        }
        a.needsUpdate = true;
      });
    }
    const flick = k > 0 ? (Math.sin(t * 70) > -0.3 ? 1 : 0.2) : 0;
    lines.forEach((l) => ((l.material as THREE.LineBasicMaterial).opacity = k * flick));
    if (flash.current) flash.current.intensity = k * 6 * flick;
    if (ring.current) {
      const s = 0.2 + (1 - k) * 1.6;
      ring.current.scale.setScalar(k > 0 ? s : 0.001);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = k * 0.7;
    }
    const h = host.current;
    if (h) {
      // mutation shimmer: brief voxel jitter + rune overcharge
      const m = k > 0 ? 1 + Math.sin(t * 55) * 0.025 * k : 1;
      h.scale.set(m, 1 + (m - 1) * -1, m);
      h.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!mat || !("emissiveIntensity" in mat)) return;
        if (mat.userData.baseGlow === undefined) mat.userData.baseGlow = mat.emissiveIntensity;
        const b = mat.userData.baseGlow as number;
        mat.emissiveIntensity = b + (b > 0 ? b * 1.5 * k : 0);
      });
    }
  });
  return (
    <group ref={bolts} raycast={noRay}>
      {lines.map((l, i) => <primitive key={i} object={l} />)}
      <pointLight ref={flash} position={[0, top * 1.1, 0]} color={glow} intensity={0} distance={span * 4} />
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} raycast={noRay}>
        <ringGeometry args={[span * 0.85, span * 0.92, 40]} />
        <meshBasicMaterial color={accent} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export const MorphBody = memo(function MorphBody({ m, unit = 1, rarity = "COMMON" }: { m: CreatureMorph; unit?: number; rarity?: GuardianRarity }) {
  const u = unit;
  const legs = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Group | null)[]>([]);
  const tail = useRef<(THREE.Group | null)[]>([]);
  const segs = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const aura = useRef<THREE.Group>(null);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.elapsedTime * m.gait;
    legs.current.forEach((g, i) => g && (g.rotation.x = Math.sin(t * 2 + (i % 2 ? Math.PI : 0) + Math.floor(i / 2) * 1.1) * 0.38));
    wings.current.forEach((g, i) => g && (g.rotation.z = (i % 2 ? -1 : 1) * (0.22 + Math.sin(t * 3 + i) * 0.42)));
    tail.current.forEach((g, i) => g && (g.rotation.y = Math.sin(t * 1.4 - i * 0.6) * 0.22));
    segs.current.forEach((g, i) => g && (g.position.x = Math.sin(t * 1.35 - i * 0.68) * 0.06 * u));
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, Math.sin(t * 0.45) * 0.1, 5, dt);
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, Math.sin(t * 0.7) * 0.025, 5, dt);
    }
    if (bob.current) bob.current.position.y = (m.plan === "FLOATER" ? Math.sin(t) * 0.12 : Math.abs(Math.sin(t * 2)) * 0.018) * u;
    if (aura.current) aura.current.rotation.y = clock.elapsedTime * 0.32;
  });

  const { primary: P, secondary: S, glow: G } = m;
  const rarityRank = rarity === "MYTHIC" ? 3 : rarity === "EPIC" ? 2 : rarity === "RARE" ? 1 : 0;
  const seedValue = useMemo(() => parseInt(m.seed.slice(-6), 16) || m.height, [m.height, m.seed]);
  const detailFlip = seedValue % 2 ? 1 : -1;
  const floor = m.plan === "SERPENT" ? m.bodyTall * 0.5 : m.plan === "FLOATER" ? 0.9 : m.legLen + m.bodyTall * 0.5;
  const upright = m.plan === "BIPED" || m.plan === "AVIAN";
  const L = m.bodyLen * u, W = m.bodyWide * u, T = m.bodyTall * u;
  const bodyY = floor * u;
  const segLen = m.plan === "SERPENT" ? L / 2.2 : L / m.segments;

  const torso = Array.from({ length: m.segments }, (_, i) => {
    const z = m.plan === "SERPENT" ? -i * segLen * 0.88 : (i - (m.segments - 1) / 2) * segLen;
    const taper = m.plan === "SERPENT" ? 1 - i / (m.segments * 1.65) : 1;
    const sideMark = ((seedValue >> (i % 12)) & 1) === 1;
    return (
      <group key={`s${i}`} ref={(g) => { segs.current[i] = m.plan === "SERPENT" ? g : null; }} position={[0, 0, z]}>
        <Box p={[0, 0, 0]} s={[W * taper, T * taper, segLen * 0.94]} c={P} />
        <Box p={[0, T * taper * 0.42, 0]} s={[W * taper * 0.78, T * 0.14, segLen * 0.78]} c={S} m={0.5} rough={0.38} />
        {[-1, 1].map((side) => <Box key={`flank-${side}`} p={[side * W * taper * 0.51, 0, 0]} s={[0.035 * u, T * taper * 0.54, segLen * 0.6]} r={[0, 0, side * 0.08]} c={sideMark ? S : P} m={0.42} />)}
        {m.pattern === "STRIPES" && <Box p={[0, T * taper * 0.515, 0]} s={[W * taper * 0.9, 0.026 * u, segLen * 0.24]} c={S} />}
        {m.pattern === "PLATES" && <Box p={[0, T * taper * 0.53, 0]} s={[W * taper * 0.66, 0.065 * u, segLen * 0.67]} c={S} m={0.72} rough={0.28} />}
        {m.pattern === "SPOTS" && [-1, 1].map((side) => <Box key={`spot-${side}`} p={[side * W * taper * 0.52, (i % 2 ? 0.1 : -0.08) * T, 0]} s={[0.025 * u, T * 0.2, T * 0.2]} c={S} />)}
        {m.pattern === "CIRCUIT" && <><Box p={[0, T * taper * 0.54, 0]} s={[0.035 * u, 0.018 * u, segLen * 0.86]} c={G} g={1.25} /><Box p={[0, T * taper * 0.55, -segLen * 0.18]} s={[W * 0.28, 0.018 * u, 0.035 * u]} c={G} g={1.05} /></>}
        {(m.plan === "SERPENT" || m.pattern === "PLATES") && i % 2 === 0 ? <Cone p={[0, T * taper * 0.66, 0]} w={0.045 * u} h={(0.12 + (i % 3) * 0.025) * u} c={i % 4 ? S : G} g={i % 4 ? 0 : 0.45} /> : null}
      </group>
    );
  });

  const headZ = m.plan === "SERPENT" ? segLen * 0.68 : L / 2 + m.neckLen * u + m.headSize * u * 0.42;
  const headY = (upright ? T * 1.1 : m.plan === "CENTAUR" ? T * 1.4 : T * 0.25) + m.neckLen * u * 0.5;
  const H = m.headSize * u;
  const eyeCount = Math.min(m.eyes, 6);
  const eyes = Array.from({ length: eyeCount }, (_, i) => {
    const cols = Math.min(eyeCount, 3);
    const x = ((i % cols) - (cols - 1) / 2) * H * 0.3;
    const y = H * 0.11 + Math.floor(i / cols) * H * 0.17;
    return <Box key={`e${i}`} p={[x, y, H * 0.515]} s={[H * 0.13, H * 0.11, 0.025 * u]} c={G} g={1.8 + rarityRank * 0.25} m={0.4} rough={0.18} />;
  });

  const horns = Array.from({ length: m.hornCount }, (_, i) => {
    const side = m.horns === "CROWN" ? (i - 2) * 0.35 : i ? 1 : -1;
    const tilt: Vec3 = m.horns === "CURL" ? [-0.9, 0, side * 0.9] : m.horns === "ANTLER" ? [-0.3, 0, side * 0.6] : [-0.3, 0, side * 0.25];
    const x = m.horns === "CROWN" ? side * H * 0.6 : side * H * 0.32;
    return (
      <group key={`h${i}`} position={[x, H * 0.5, 0]} rotation={tilt}>
        <Cone p={[0, H * 0.3, 0]} w={H * 0.08} h={H * (m.horns === "ANTLER" ? 0.9 : 0.6)} c={m.horns === "CROWN" ? G : S} g={m.horns === "CROWN" ? 0.8 : 0} />
        {m.horns === "ANTLER" && <><Cone p={[H * 0.12, H * 0.4, 0]} r={[0, 0, -0.8]} w={H * 0.05} h={H * 0.4} c={S} /><Cone p={[-H * 0.1, H * 0.52, 0]} r={[0, 0, 0.75]} w={H * 0.04} h={H * 0.32} c={S} /></>}
      </group>
    );
  });

  const legNodes: React.ReactNode[] = [];
  for (let pair = 0; pair < m.legPairs; pair++) {
    const z = m.legPairs === 1 ? 0 : (pair / (m.legPairs - 1) - 0.5) * L * 0.82;
    for (const side of [-1, 1]) {
      const i = pair * 2 + (side > 0 ? 1 : 0);
      const spread = m.plan === "ARACHNID" || m.plan === "HEXAPOD" ? 0.64 : 0;
      legNodes.push(
        <group key={`l${i}`} position={[side * W * 0.5, -T * 0.28, z]} rotation={[0, 0, side * spread]} ref={(g) => { legs.current[i] = g; }}>
          <Box p={[0, -m.legLen * u * 0.28, 0]} s={[0.13 * u, m.legLen * u * 0.58, 0.14 * u]} c={P} />
          <Box p={[0, -m.legLen * u * 0.22, 0.075 * u]} s={[0.16 * u, m.legLen * u * 0.25, 0.055 * u]} c={S} m={0.58} rough={0.32} />
          <Joint p={[0, -m.legLen * u * 0.58, 0.015 * u]} c={G} u={u} />
          <Box p={[0, -m.legLen * u * 0.78, 0.035 * u]} s={[0.095 * u, m.legLen * u * 0.35, 0.1 * u]} r={[detailFlip * 0.04, 0, 0]} c={S} />
          <Box p={[0, -m.legLen * u - 0.005 * u, 0.085 * u]} s={[0.18 * u, 0.075 * u, 0.23 * u]} c={P} m={0.35} />
          {[-1, 0, 1].map((claw) => <Cone key={`claw-${claw}`} p={[claw * 0.058 * u, -m.legLen * u - 0.01 * u, 0.235 * u]} r={[Math.PI / 2, 0, 0]} w={0.018 * u} h={0.11 * u} c={claw === 0 ? G : S} g={claw === 0 ? 0.25 : 0} />)}
        </group>,
      );
    }
  }

  const wingNodes = Array.from({ length: m.wings }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const z = i < 2 ? L * 0.1 : -L * 0.25;
    const span = m.wingSpan * u * (i < 2 ? 1 : 0.7);
    return (
      <group key={`w${i}`} position={[side * W * 0.45, T * 0.38, z]} ref={(g) => { wings.current[i] = g; }}>
        <Box p={[side * span * 0.28, 0, 0]} s={[span * 0.58, 0.09 * u, 0.13 * u]} r={[0, 0, side * 0.08]} c={S} m={0.54} />
        <Joint p={[side * span * 0.58, 0, 0]} c={G} u={u} />
        {[0, 1, 2, 3, 4].map((f) => {
          const length = span * (0.76 - f * 0.075);
          return <Box key={`feather-${f}`} p={[side * (span * 0.52 + length * 0.45), -f * 0.035 * u, (-0.2 + f * 0.11) * L]} s={[length, 0.035 * u, L * 0.15]} r={[0, side * (0.04 + f * 0.018), side * (0.18 + f * 0.035)]} c={f % 2 ? P : S} m={f === 0 ? 0.5 : 0.2} />;
        })}
        <Box p={[side * span * 0.5, 0.035 * u, -L * 0.05]} s={[span * 0.86, 0.025 * u, 0.045 * u]} c={G} g={0.72 + rarityRank * 0.14} m={0.65} />
      </group>
    );
  });

  const tailNodes = Array.from({ length: m.tailSegs }, (_, i) => {
    const taper = 1 - i / (m.tailSegs + 2);
    const back = m.plan === "SERPENT" ? -(m.segments - 1) * segLen * 0.88 - segLen * 0.6 : -L / 2;
    return (
      <group key={`t${i}`} ref={(g) => { tail.current[i] = g; }} position={[0, m.plan === "FLOATER" ? -T * 0.6 - i * 0.12 * u : T * 0.1, back - i * 0.135 * u]}>
        <Box p={[0, 0, -0.065 * u]} s={[0.15 * u * taper, 0.15 * u * taper, 0.15 * u]} c={i === m.tailSegs - 1 ? G : i % 2 ? S : P} g={i === m.tailSegs - 1 ? 0.9 : 0} m={0.38} />
        {i === m.tailSegs - 1 && m.tailSegs > 2 ? <><Cone p={[0.09 * u, 0, -0.1 * u]} r={[0, 0, -Math.PI / 2]} w={0.035 * u} h={0.18 * u} c={G} g={0.45} /><Cone p={[-0.09 * u, 0, -0.1 * u]} r={[0, 0, Math.PI / 2]} w={0.035 * u} h={0.18 * u} c={G} g={0.45} /></> : null}
      </group>
    );
  });

  const spineNodes = Array.from({ length: m.spines }, (_, i) => (
    <group key={`p${i}`} position={[0, T * 0.5 + 0.055 * u, L * 0.4 - (i / Math.max(1, m.spines - 1)) * L * 0.8]}>
      <Cone p={[0, 0.075 * u, 0]} w={0.052 * u} h={(0.16 + (i % 2) * 0.045) * u} c={i % 3 ? S : G} g={i % 3 ? 0 : 0.45} />
      <Box p={[0, 0, 0]} s={[0.15 * u, 0.035 * u, 0.12 * u]} c={S} m={0.62} />
    </group>
  ));

  const arms = upright || m.plan === "CENTAUR" ? [-1, 1].map((side) => (
    <group key={`arm-${side}`} position={[side * W * 0.58, bodyY + T * 0.72, upright ? L * 0.02 : L * 0.34]} rotation-z={side * 0.14}>
      <Box p={[0, -0.14 * u, 0]} s={[0.14 * u, 0.32 * u, 0.16 * u]} c={P} />
      <Joint p={[0, -0.32 * u, 0]} c={G} u={u} />
      <Box p={[0, -0.47 * u, 0.055 * u]} s={[0.12 * u, 0.27 * u, 0.13 * u]} c={S} />
      <Box p={[0, -0.63 * u, 0.11 * u]} s={[0.18 * u, 0.12 * u, 0.2 * u]} c={P} />
    </group>
  )) : null;

  const auraCount = rarityRank === 3 ? 8 : rarityRank === 2 ? 5 : rarityRank === 1 ? 3 : 0;

  const creature = useRef<THREE.Group>(null);
  const surgeTop = bodyY + headY + H;
  return (
    <group raycast={noRay}>
    <DnaSurge host={creature} span={Math.max(L, W)} top={surgeTop} glow={G} accent={S} />
    <group ref={(g) => { bob.current = g; creature.current = g; }} raycast={noRay}>
      <group position={[0, bodyY, 0]} rotation={[upright ? -0.9 : 0, 0, 0]}>
        {torso}
        {legNodes.length && !upright ? legNodes : null}
        {wingNodes}
        {tailNodes}
        {spineNodes}
        {m.plan === "FLOATER" && <><mesh position={[0, T * 0.3, 0]} rotation={[0.6, 0.6, 0]} raycast={noRay}><octahedronGeometry args={[W * 0.34, 1]} /><meshStandardMaterial color={G} emissive={G} emissiveIntensity={1.5} metalness={0.45} roughness={0.2} /></mesh>{[-1, 1].map((side) => <Box key={`float-plate-${side}`} p={[side * W * 0.5, T * 0.2, 0]} s={[W * 0.2, T * 0.55, L * 0.35]} r={[0, 0, side * 0.25]} c={S} m={0.65} />)}</>}
      </group>
      {upright ? <group position={[0, m.legLen * u, 0]}>{legNodes}</group> : null}
      {arms}
      <group ref={head} position={[0, bodyY + headY, upright ? L * 0.1 : headZ]}>
        <Box p={[0, 0, 0]} s={[H, H * 0.8, H]} c={P} />
        <Box p={[0, H * 0.27, -H * 0.03]} s={[H * 0.78, H * 0.2, H * 0.82]} c={S} m={0.56} rough={0.34} />
        <Box p={[0, -H * 0.25, H * 0.45]} s={[H * 0.72, H * 0.25, H * 0.42]} c={S} />
        <Box p={[0, -H * 0.36, H * 0.48]} s={[H * 0.52, H * 0.08, H * 0.34]} c={P} m={0.34} />
        {[-1, 1].map((side) => <group key={`cheek-${side}`}><Box p={[side * H * 0.43, -H * 0.05, H * 0.19]} s={[H * 0.14, H * 0.42, H * 0.52]} r={[0, 0, side * 0.12]} c={side === detailFlip ? G : S} g={side === detailFlip ? 0.24 : 0} m={0.58} /><Cone p={[side * H * 0.5, -H * 0.16, H * 0.08]} r={[0, 0, -side * Math.PI / 2]} w={H * 0.07} h={H * 0.28} c={S} /></group>)}
        <Box p={[0, H * 0.1, H * 0.515]} s={[H * 0.84, H * 0.09, 0.028 * u]} c={S} m={0.66} />
        {m.plan === "AVIAN" ? <Cone p={[0, -H * 0.05, H * 0.76]} r={[Math.PI / 2, 0, 0]} w={H * 0.15} h={H * 0.48} c={G} g={0.18} /> : <><Box p={[0, -H * 0.14, H * 0.68]} s={[H * 0.5, H * 0.22, H * 0.32]} c={P} /><Box p={[0, -H * 0.12, H * 0.855]} s={[H * 0.3, H * 0.12, H * 0.07]} c={S} m={0.45} /></>}
        {(m.plan === "SERPENT" || m.plan === "ARACHNID") && [-1, 1].map((side) => <Cone key={`fang-${side}`} p={[side * H * 0.2, -H * 0.34, H * 0.72]} r={[Math.PI, 0, 0]} w={H * 0.045} h={H * 0.28} c={G} g={0.2} />)}
        {m.plan === "ARACHNID" && [-1, 1].map((side) => <group key={`mandible-${side}`} rotation-y={side * 0.18}><Box p={[side * H * 0.3, -H * 0.28, H * 0.7]} s={[H * 0.14, H * 0.14, H * 0.38]} c={S} m={0.52} /><Cone p={[side * H * 0.3, -H * 0.28, H * 0.96]} r={[Math.PI / 2, 0, 0]} w={H * 0.05} h={H * 0.24} c={G} /></group>)}
        {eyes}
        {horns}
        {m.pattern === "CIRCUIT" || rarityRank > 1 ? <Sigil p={[0, H * 0.3, H * 0.515]} c={G} u={u * Math.max(0.45, m.headSize)} glow={0.75 + rarityRank * 0.2} /> : null}
      </group>
      {m.plan === "CENTAUR" ? <><Box p={[0, bodyY + T * 0.9, L * 0.35]} s={[W * 0.7, T * 1.2, W * 0.5]} c={P} /><Box p={[0, bodyY + T * 1.12, L * 0.55]} s={[W * 0.48, T * 0.42, 0.06 * u]} c={S} m={0.68} /><Sigil p={[0, bodyY + T * 1.12, L * 0.585]} c={G} u={u * 0.8} /></> : null}
      {rarityRank > 0 ? <group ref={aura}>{Array.from({ length: auraCount }, (_, i) => { const a = i / auraCount * Math.PI * 2; const radius = (0.62 + (i % 2) * 0.14) * Math.max(L, W); return <mesh key={`mote-${i}`} position={[Math.sin(a) * radius, (0.3 + (i % 3) * 0.23) * u, Math.cos(a) * radius]} raycast={noRay}><octahedronGeometry args={[(0.025 + rarityRank * 0.009) * u, 0]} /><meshStandardMaterial color={G} emissive={G} emissiveIntensity={1.1 + rarityRank * 0.3} /></mesh>; })}</group> : null}
      {rarity === "MYTHIC" ? <mesh position={[0, (bodyY + headY + H * 0.95), upright ? L * 0.1 : headZ]} rotation-x={Math.PI / 2} raycast={noRay}><torusGeometry args={[H * 0.72, 0.018 * u, 4, 18]} /><meshStandardMaterial color={G} emissive={G} emissiveIntensity={1.5} transparent opacity={0.78} /></mesh> : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} raycast={noRay}>
        <circleGeometry args={[Math.max(L, W) * 0.9, 32]} />
        <meshBasicMaterial color={G} transparent opacity={0.08 + rarityRank * 0.025} depthWrite={false} />
      </mesh>
    </group>
    </group>
  );
});
