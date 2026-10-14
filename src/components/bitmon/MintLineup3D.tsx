/**
 * Live mint backdrop: real awakened Guardians (inscribed first) standing on
 * BITMAP parcel land, with real inscribed Land Forge builds behind them.
 * Everything is drawn by the same engine the Oasis uses — nothing invented.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { forgeDirectoryQuery } from "@/lib/builds";

function Bob({ phase, children }: { phase: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + phase;
    g.current.position.y = Math.sin(t * 1.6) * 0.03;
    g.current.rotation.y = Math.sin(t * 0.4) * 0.25;
  });
  return <group ref={g}>{children}</group>;
}

function Drift() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.08;
    camera.position.set(Math.sin(t) * 1.2, 2.1, 7.2);
    camera.lookAt(0, 0.9, -1);
  });
  return null;
}

/** Parcel-style floor: hairline cyan grid with a few lit orange tiles. */
function ParcelFloor() {
  const tiles = useMemo(() => {
    const out: [number, number, number, number][] = [];
    let s = 21;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) out.push([Math.floor(r() * 24 - 12), Math.floor(r() * 14 - 10), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)]);
    return out;
  }, []);
  return (
    <group position={[0, -0.01, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#07090c" roughness={0.9} />
      </mesh>
      <gridHelper args={[60, 60, "#22d3ee", "#0e3a44"]} position={[0, 0.005, 0]} />
      {tiles.map(([x, z, w, d], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x + w / 2, 0.01, z + d / 2]}>
          <planeGeometry args={[w - 0.06, d - 0.06]} />
          <meshBasicMaterial color={i % 3 ? "#f7931a" : "#22d3ee"} transparent opacity={i % 3 ? 0.18 : 0.12} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function MintLineup3D() {
  const all = useQuery(allGuardiansQuery());
  const builds = useQuery(forgeDirectoryQuery());
  const lineup = useMemo(() => {
    const list = [...(all.data ?? [])].sort((a, b) => Number(!!b.inscriptionId) - Number(!!a.inscriptionId));
    return list.slice(0, 7);
  }, [all.data]);
  const towers = useMemo(() => {
    const seen = new Set<number>();
    return (builds.data ?? []).filter((b) => (seen.has(b.bitmap_height) ? false : (seen.add(b.bitmap_height), true))).slice(0, 3);
  }, [builds.data]);
  // Centre-out ordering so the strongest (first) Guardian stands in the middle.
  const slots = lineup.map((_, i) => (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2)));

  return (
    <SafeCanvas dpr={[1, 1.5]} camera={{ position: [0, 2.1, 7.2], fov: 40 }} gl={{ powerPreference: "low-power", antialias: true }}>
      <color attach="background" args={["#05070a"]} />
      <fog attach="fog" args={["#05070a", 7, 22]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 7, 5]} intensity={1.5} />
      <pointLight position={[0, 3, 3]} intensity={1.2} color="#22d3ee" />
      <pointLight position={[-5, 2, -4]} intensity={1.6} color="#f7931a" />
      <ParcelFloor />
      {towers.map((b, i) => (
        <ForgeBuild3D key={b.bitmap_height} height={b.bitmap_height} cell={5} position={[(i - (towers.length - 1) / 2) * 7.5, 0, -7 - (i % 2) * 2]} />
      ))}
      {lineup.map((g, i) => {
        const x = slots[i]! * 1.55;
        const z = -Math.abs(slots[i]!) * 0.35;
        const s = i === 0 ? 1.35 : 1;
        return (
          <group key={g.height} position={[x, 0, z]} scale={s}>
            <Bob phase={i * 1.3}>
              <GuardianBody species={g.species} rarity={g.rarity} body={g.body} accent={g.accent} height={g.height} inscribed={!!g.inscriptionId} />
            </Bob>
          </group>
        );
      })}
      <Drift />
    </SafeCanvas>
  );
}
