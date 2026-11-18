import { Suspense, useMemo, useEffect } from "react";
import * as THREE from "three";
import type { DecodedMesh } from "@/lib/l2/ue2-staticmesh";
import type { DecodedTexture } from "@/lib/l2/ue2-texture";
import { OrbitControls, Grid } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import type { SwapTarget } from "@/lib/l2/ue2-package";

export interface BridgeActor { key: string; name: string; target: SwapTarget }

function Guardian({ height, position }: { height: number; position: [number, number, number] }) {
  const d = useQuery(guardianDnaQuery(height)).data;
  if (!d) return null;
  return <group position={position} scale={1.6}><GuardianBody species={d.species} rarity={d.rarity} body={d.body} accent={d.accent} height={height} /></group>;
}

function SlabStandIn({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={[position[0], 0.9, position[2]]} castShadow>
      <boxGeometry args={[1.1, 1.6, 0.18]} />
      <meshStandardMaterial color="#f7931a" metalness={0.6} roughness={0.25} />
    </mesh>
  );
}

function RealMesh({ mesh, textures }: { mesh: DecodedMesh; textures: (DecodedTexture | null)[] }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    if (mesh.uvs) g.setAttribute("uv", new THREE.BufferAttribute(mesh.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    mesh.groups.forEach((gr, i) => g.addGroup(gr.start, gr.count, i));
    g.computeBoundingBox();
    return g;
  }, [mesh]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mats = useMemo(() => {
    const n = Math.max(1, mesh.groups.length);
    return Array.from({ length: n }, (_, i) => {
      const t = textures[i] ?? (mesh.groups.length ? null : textures[0]) ?? null;
      if (!t || !mesh.uvs) return new THREE.MeshStandardMaterial({ color: "#c9b79a", roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
      const tex = new THREE.DataTexture(t.rgba, t.width, t.height, THREE.RGBAFormat);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
      tex.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, alphaTest: t.hasAlpha ? 0.5 : 0, transparent: false });
    });
  }, [mesh, textures]);
  useEffect(() => () => mats.forEach((m) => { m.map?.dispose(); m.dispose(); }), [mats]);
  const box = geo.boundingBox!;
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = 4 / Math.max(size.x, size.y, size.z, 1e-3);
  return (
    <group scale={k} position={[-c.x * k, -box.min.y * k, -c.z * k]}>
      <mesh geometry={geo} material={mesh.groups.length ? mats : mats[0]!} castShadow receiveShadow />
    </group>
  );
}

function TexturePanel({ t }: { t: DecodedTexture }) {
  const tex = useMemo(() => {
    const x = new THREE.DataTexture(t.rgba, t.width, t.height, THREE.RGBAFormat);
    x.colorSpace = THREE.SRGBColorSpace; x.magFilter = THREE.LinearFilter; x.minFilter = THREE.LinearMipmapLinearFilter; x.generateMipmaps = true; x.flipY = false; x.needsUpdate = true;
    return x;
  }, [t]);
  useEffect(() => () => tex.dispose(), [tex]);
  const k = 4 / Math.max(t.width, t.height);
  return (
    <mesh position={[0, (t.height * k) / 2 + 0.2, 0]} scale={[1, -1, 1]}>
      <planeGeometry args={[t.width * k, t.height * k]} />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} alphaTest={t.hasAlpha ? 0.5 : 0} toneMapped={false} />
    </mesh>
  );
}

/** Decoded L2 actors laid out in a row, each replaced by its Bitcoin model. */
export default function L2BridgeScene({ actors, guardianHeight, mesh, textures = [], texture = null }: { actors: BridgeActor[]; guardianHeight: number; mesh?: DecodedMesh | null; textures?: (DecodedTexture | null)[]; texture?: DecodedTexture | null }) {
  const shown = actors.filter((a) => a.target !== "keep").slice(0, 12);
  return (
    <SafeCanvas camera={{ position: [0, 4, 9], fov: 45 }} shadows>
      <color attach="background" args={["#07090c"]} />
      <hemisphereLight args={["#bfe9ff", "#1a1206", 0.9]} />
      <directionalLight position={[5, 8, 4]} intensity={1.6} castShadow />
      <Grid args={[40, 40]} cellColor="#1d3640" sectionColor="#2bd4e6" fadeDistance={30} infiniteGrid />
      <Suspense fallback={null}>
        {texture ? <TexturePanel t={texture} /> : mesh ? <RealMesh mesh={mesh} textures={textures} /> : shown.length === 0 ? <Guardian height={guardianHeight} position={[0, 0, 0]} /> : shown.map((a, i) => {
          const x = (i - (shown.length - 1) / 2) * 2.4;
          return a.target === "guardian"
            ? <Guardian key={a.key} height={guardianHeight + i} position={[x, 0, 0]} />
            : <SlabStandIn key={a.key} position={[x, 0, 0]} />;
        })}
      </Suspense>
      <OrbitControls makeDefault target={[0, 1, 0]} />
    </SafeCanvas>
  );
}
