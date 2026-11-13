import { useEffect, useMemo, useRef, useState } from "react";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { BlockLayout } from "@/lib/bitmap-layout";
import type { SlabGrade } from "@/lib/land-slab";
import type { ParcelInscription } from "@/lib/slab-inscriptions.functions";
import { mathTraits, satReading } from "@/lib/slab-rarity";
import { drawSlabIcon, slabIcons } from "@/lib/slab-icons";
import { slabSkin, type SlabSkin } from "@/lib/slab-skins";

const noRay = () => null;
const zoomSafeEvents = (store: Parameters<typeof r3fEvents>[0]) => ({
  ...r3fEvents(store),
  compute(e: { clientX: number; clientY: number }, state: RootState) {
    const r = state.gl.domElement.getBoundingClientRect();
    state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.raycaster.setFromCamera(state.pointer, state.camera);
  },
});

/** Parcel colour by what was inscribed there (cyan family = live data, per the site palette). */
export function inscriptionTint(type: string): string {
  if (type.startsWith("image/")) return "#2fe6ff";
  if (type.includes("html")) return "#ff4fd8";
  if (type.includes("json")) return "#a3ff5a";
  if (type.startsWith("text/")) return "#f4f1e8";
  if (type.startsWith("model/")) return "#b18cff";
  if (type.startsWith("audio/") || type.startsWith("video/")) return "#ffd23f";
  return "#7fd8e8";
}
const ART_CAP = 24;

// Slab proportions follow a PSA holder: 3.3 × 5.4 with a label band on top.
const W = 3.3, H = 5.4, D = 0.32;
const LABEL_H = 1.15;
const PSA_RED = "#c8102e";

type Props = {
  height: number; layout: BlockLayout; grade: SlabGrade; flipped: boolean; hash: string | null; sat?: number | null;
  inscriptions?: ParcelInscription[]; selected?: number | null; onPick?: (tx: number | null) => void; skin?: string | undefined;
};

function labelTexture(height: number, grade: SlabGrade, back: boolean, hash: string | null, sat: number | null) {
  const reading = sat != null ? satReading(sat) : null;
  const icons = slabIcons(reading, mathTraits(height, hash, sat));
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 360;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f7f5f0"; g.fillRect(0, 0, 1024, 360);
  g.strokeStyle = PSA_RED; g.lineWidth = 22; g.strokeRect(11, 11, 1002, 338);
  g.fillStyle = "#111";
  if (!back) {
    g.font = "bold 46px 'Space Grotesk', sans-serif";
    g.fillText(`${height}.BITMAP`, 48, 92);
    g.font = "28px 'Space Mono', monospace";
    g.fillText("BITCOIN L1 · BLOCK LAND", 48, 140);
    g.fillText(grade.subs.map((s) => `${s.label[0]}${s.score}`).join("  "), 48, 188);
    g.fillText(`CERT ${grade.cert}`, 48, 236);
    // barcode from cert characters — decorative but deterministic
    let x = 48;
    for (const ch of grade.cert + grade.cert) {
      const v = ch.charCodeAt(0);
      for (let b = 0; b < 4; b++) {
        const w = 2 + ((v >> b) & 3) * 2;
        if ((v >> b) & 1) g.fillRect(x, 262, w, 60);
        x += w + 2;
        if (x > 290) break;
      }
      if (x > 290) break;
    }
    icons.slice(0, 6).forEach((ic, i) => drawSlabIcon(g, ic, 312 + i * 76, 256, 70));
    g.fillStyle = "#111";
    g.textAlign = "right";
    g.font = "bold 40px 'Space Grotesk', sans-serif";
    g.fillText(grade.name, 976, 120);
    g.font = "bold 150px 'Space Grotesk', sans-serif";
    g.fillStyle = PSA_RED;
    g.fillText(String(grade.grade), 976, 290);
  } else {
    g.font = "bold 38px 'Space Grotesk', sans-serif";
    g.fillText("PROVENANCE · RE-DERIVE IT YOURSELF", 48, 84);
    g.font = "24px 'Space Mono', monospace";
    g.font = "22px 'Space Mono', monospace";
    g.fillText(`HEIGHT ${height.toLocaleString("en-US")}`, 48, 124);
    g.fillText(`HASH ${(hash ?? "unavailable").slice(0, 32)}`, 48, 154);
    g.fillText(`     ${(hash ?? "").slice(32)}`, 48, 182);
    g.fillText(reading ? `SAT ${reading.sat.toLocaleString("en-US")} · ${reading.rarity} · MINED ${reading.minedIn.toLocaleString("en-US")}` : "SAT NOT RESOLVED", 48, 214);
    let ix = 48, iy = 232;
    g.font = "16px 'Space Mono', monospace";
    for (const ic of icons.slice(0, 8)) {
      const w = 48 + g.measureText(ic.label).width + 18;
      if (ix + w > 990) { ix = 48; iy += 40; if (iy > 272) break; }
      drawSlabIcon(g, ic, ix, iy, 38);
      g.fillStyle = "#111";
      g.fillText(ic.label, ix + 46, iy + 25);
      ix += w;
    }
    if (!icons.length) g.fillText("NO SAT OR MATHEMATICAL RARITIES", 48, 254);
    g.font = "18px 'Space Mono', monospace";
    g.fillText("GRADE = BITMAPWIN RUBRIC FROM BLOCK + SAT FACTS, NOT AN OWNERSHIP CLAIM", 48, 330);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function useGeom(layout: BlockLayout) {
  const side = Math.max(layout.width, layout.height);
  const span = 2.5;
  const unit = span / side;
  const offY = (side - layout.height) / 2;
  return (i: number) => {
    const p = layout.parcels[i]!;
    const s = p.size * unit * 0.88;
    const h = 0.04 + p.size * unit * 0.6;
    return { x: (p.position.x + p.size / 2) * unit - span / 2, y: span / 2 - (p.position.y + offY + p.size / 2) * unit, s, h };
  };
}

function Land({ layout, ins, selected, onPick, skin }: { layout: BlockLayout; ins: Map<number, ParcelInscription>; selected: number | null; onPick?: ((tx: number | null) => void) | undefined; skin: SlabSkin }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useGeom(layout);
  const count = layout.parcels.length;
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    layout.parcels.forEach((p, i) => {
      const g = geom(i);
      const lift = ins.has(i) ? 3 : 1;
      const h = g.h * lift * (selected === i ? 1.6 : 1);
      o.position.set(g.x, g.y, h / 2);
      o.scale.set(g.s, g.s, h);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      const it = ins.get(i);
      if (it) col.set(inscriptionTint(it.type));
      else if (ins.size) col.setHSL(0.07, 0.3, 0.035 + Math.min(0.03, p.size * 0.006));
      else col.setHSL(skin.rainbow ? (i * 0.071) % 1 : skin.land.hue, skin.land.sat, skin.land.light + Math.min(0.12, p.size * 0.02));
      if (selected === i) col.offsetHSL(0, 0, 0.15);
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [layout, geom, ins, selected, skin]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(1, count)]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.instanceId != null) onPick?.(ins.has(e.instanceId) ? e.instanceId : null); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { if (e.instanceId != null && ins.has(e.instanceId)) document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <boxGeometry />
      <meshStandardMaterial roughness={skin.id === "gold" ? 0.25 : 0.45} metalness={skin.id === "gold" ? 0.7 : 0.15} emissiveIntensity={0} />
    </instancedMesh>
  );
}

/** Real image inscriptions laid on top of their parcels, loaded from ordinals.com/content. */
function ArtTiles({ layout, items }: { layout: BlockLayout; items: ParcelInscription[] }) {
  const geom = useGeom(layout);
  const [tex, setTex] = useState<Map<string, THREE.Texture>>(new Map());
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const made: THREE.Texture[] = [];
    items.forEach((it) => {
      if (!it.id) return;
      const id = it.id;
      loader.load(`https://ordinals.com/content/${id}`, (t) => {
        if (!alive) { t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace;
        t.magFilter = THREE.NearestFilter;
        made.push(t);
        setTex((m) => new Map(m).set(id, t));
      }, undefined, () => {});
    });
    return () => { alive = false; made.forEach((t) => t.dispose()); };
  }, [items]);
  return (
    <>
      {items.map((it) => {
        const t = it.id ? tex.get(it.id) : undefined;
        if (!t || it.tx >= layout.parcels.length) return null;
        const g = geom(it.tx);
        return (
          <mesh key={it.txid} position={[g.x, g.y, g.h * 3 + 0.002]} raycast={noRay}>
            <planeGeometry args={[g.s * 0.96, g.s * 0.96]} />
            <meshBasicMaterial map={t} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}

/** Voxel moss and little trees on the smaller parcels (Living Biome skin). */
function Foliage({ layout }: { layout: BlockLayout }) {
  const leaves = useRef<THREE.InstancedMesh>(null);
  const geom = useGeom(layout);
  const picks = useMemo(() => layout.parcels.map((_, i) => i).filter((i) => (i * 2654435761) % 7 < 3).slice(0, 400), [layout]);
  useEffect(() => {
    const m = leaves.current; if (!m) return;
    const o = new THREE.Object3D(); const c = new THREE.Color();
    picks.forEach((i, k) => {
      const g = geom(i); const s = Math.max(0.03, g.s * 0.55);
      o.position.set(g.x, g.y, g.h + s * 0.6); o.scale.set(s, s, s * 1.2); o.updateMatrix();
      m.setMatrixAt(k, o.matrix); c.setHSL(0.26 + (k % 5) * 0.03, 0.6, 0.28 + (k % 3) * 0.06); m.setColorAt(k, c);
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [picks, geom]);
  return (
    <instancedMesh ref={leaves} args={[undefined, undefined, Math.max(1, picks.length)]} raycast={noRay}>
      <boxGeometry /><meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

function Slab({ height, layout, grade, flipped, hash, sat = null, inscriptions, selected = null, onPick, skin: skinId }: Props) {
  const skin = slabSkin(skinId);
  const ins = useMemo(() => new Map((inscriptions ?? []).map((x) => [x.tx, x])), [inscriptions]);
  const art = useMemo(() => (inscriptions ?? []).filter((x) => x.id && x.type.startsWith("image/") && !x.type.includes("svg")).slice(0, ART_CAP), [inscriptions]);
  const group = useRef<THREE.Group>(null);
  const land = useRef<THREE.Group>(null);
  const front = useMemo(() => labelTexture(height, grade, false, hash, sat), [height, grade, hash, sat]);
  const back = useMemo(() => labelTexture(height, grade, true, hash, sat), [height, grade, hash, sat]);
  useEffect(() => () => { front.dispose(); back.dispose(); }, [front, back]);

  useFrame((state, dt) => {
    const g = group.current; if (!g) return;
    const d = Math.min(dt, 0.05);
    const k = 1 - Math.exp(-6 * d);
    const ty = (flipped ? Math.PI : 0) + state.pointer.x * 0.35;
    const tx = -state.pointer.y * 0.25;
    g.rotation.y += (ty - g.rotation.y) * k;
    g.rotation.x += (tx - g.rotation.x) * k;
    g.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.04;
    if (land.current) land.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.12;
  });

  const labelY = H / 2 - LABEL_H / 2 - 0.12;
  const wellY = -LABEL_H / 2 + 0.02;
  return (
    <group ref={group}>
      {/* living land inside the well */}
      <group ref={land} position={[0, wellY, -0.06]}>
        <Land layout={layout} ins={ins} selected={selected} onPick={onPick} skin={skin} />
        {skin.foliage && <Foliage layout={layout} />}
        <ArtTiles layout={layout} items={art} />
      </group>
      {/* back plate behind the land */}
      <mesh position={[0, wellY, -0.1]} onClick={() => onPick?.(null)}>
        <planeGeometry args={[W - 0.3, H - LABEL_H - 0.45]} />
        <meshStandardMaterial color={skin.plate} roughness={skin.id === "gold" ? 0.4 : 0.9} metalness={skin.id === "gold" ? 0.8 : 0} side={THREE.DoubleSide} />
      </mesh>
      {/* labels */}
      <mesh position={[0, labelY, D / 2 - 0.05]} raycast={noRay}>
        <planeGeometry args={[W - 0.3, LABEL_H - 0.05]} />
        <meshStandardMaterial map={front} roughness={0.5} />
      </mesh>
      <mesh position={[0, labelY, -D / 2 + 0.05]} raycast={noRay} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W - 0.3, LABEL_H - 0.05]} />
        <meshStandardMaterial map={back} roughness={0.5} />
      </mesh>
      {/* acrylic holder */}
      <RoundedBox args={[W, H, D]} radius={0.12} smoothness={4} raycast={noRay}>
        <meshPhysicalMaterial
          transmission={skin.capsule.transmission}
          roughness={skin.capsule.roughness}
          metalness={skin.capsule.metalness}
          iridescence={skin.capsule.iridescence}
          iridescenceIOR={1.6}
          thickness={1.2}
          ior={1.491}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transparent
          opacity={skin.capsule.opacity}
          color={skin.capsule.color}
        />
      </RoundedBox>
      {skin.trim && [[0, H / 2, W, 0.06], [0, -H / 2, W, 0.06], [W / 2, 0, 0.06, H], [-W / 2, 0, 0.06, H]].map(([x, y, w, h], k) => (
        <mesh key={k} position={[x!, y!, 0]} raycast={noRay}>
          <boxGeometry args={[w!, h!, D + 0.02]} />
          <meshStandardMaterial color={skin.trim!} metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

export function LandSlab3D(props: Props) {
  return (
    <div className="h-full w-full" data-scene-ready>
      <SafeCanvas events={zoomSafeEvents} camera={{ position: [0, 0, 8.2], fov: 38 }} dpr={[1, 2]}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 6]} intensity={1.6} />
        <pointLight position={[-3, -2, 3]} intensity={18} color="#ff9a3c" />
        <Environment resolution={128}>
          <Lightformer intensity={2.5} position={[0, 5, 2]} scale={[10, 3, 1]} />
          <Lightformer intensity={1.2} color="#9fd8e8" position={[-5, 0, 1]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
          <Lightformer intensity={1.2} color="#ffb070" position={[5, 0, 1]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
        </Environment>
        <Slab {...props} />
      </SafeCanvas>
    </div>
  );
}
