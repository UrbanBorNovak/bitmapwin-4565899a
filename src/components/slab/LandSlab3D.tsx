import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { BlockLayout } from "@/lib/bitmap-layout";
import type { SlabGrade } from "@/lib/land-slab";

// Slab proportions follow a PSA holder: 3.3 × 5.4 with a label band on top.
const W = 3.3, H = 5.4, D = 0.32;
const LABEL_H = 1.15;
const PSA_RED = "#c8102e";

type Props = { height: number; layout: BlockLayout; grade: SlabGrade; flipped: boolean; hash: string | null };

function labelTexture(height: number, grade: SlabGrade, back: boolean, hash: string | null) {
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
        if (x > 600) break;
      }
      if (x > 600) break;
    }
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
    g.fillText(`HEIGHT ${height.toLocaleString("en-US")}`, 48, 136);
    g.fillText(`HASH ${(hash ?? "unavailable").slice(0, 32)}`, 48, 176);
    g.fillText(`     ${(hash ?? "").slice(32)}`, 48, 210);
    g.fillText("GRADE = BITMAPWIN RUBRIC FROM BLOCK FACTS,", 48, 264);
    g.fillText("NOT AN ON-CHAIN PROPERTY OR OWNERSHIP CLAIM", 48, 300);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Land({ layout }: { layout: BlockLayout }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const side = Math.max(layout.width, layout.height);
  const span = 2.5;
  const unit = span / side;
  const count = layout.parcels.length;
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    const offY = (side - layout.height) / 2;
    layout.parcels.forEach((p, i) => {
      const s = p.size * unit * 0.88;
      const h = 0.04 + p.size * unit * 0.6;
      o.position.set(
        (p.position.x + p.size / 2) * unit - span / 2,
        span / 2 - (p.position.y + offY + p.size / 2) * unit,
        h / 2,
      );
      o.scale.set(s, s, h);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      col.setHSL(0.075, 0.95, 0.42 + Math.min(0.25, p.size * 0.04));
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [layout, side, unit]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, count)]}>
      <boxGeometry />
      <meshStandardMaterial roughness={0.45} metalness={0.15} />
    </instancedMesh>
  );
}

function Slab({ height, layout, grade, flipped, hash }: Props) {
  const group = useRef<THREE.Group>(null);
  const land = useRef<THREE.Group>(null);
  const front = useMemo(() => labelTexture(height, grade, false, hash), [height, grade, hash]);
  const back = useMemo(() => labelTexture(height, grade, true, hash), [height, grade, hash]);
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
        <Land layout={layout} />
      </group>
      {/* back plate behind the land */}
      <mesh position={[0, wellY, -0.1]}>
        <planeGeometry args={[W - 0.3, H - LABEL_H - 0.45]} />
        <meshStandardMaterial color="#0b0f14" roughness={0.9} />
      </mesh>
      {/* labels */}
      <mesh position={[0, labelY, D / 2 - 0.05]}>
        <planeGeometry args={[W - 0.3, LABEL_H - 0.05]} />
        <meshStandardMaterial map={front} roughness={0.5} />
      </mesh>
      <mesh position={[0, labelY, -D / 2 + 0.05]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W - 0.3, LABEL_H - 0.05]} />
        <meshStandardMaterial map={back} roughness={0.5} />
      </mesh>
      {/* acrylic holder */}
      <RoundedBox args={[W, H, D]} radius={0.12} smoothness={4}>
        <meshPhysicalMaterial
          transmission={0.96}
          roughness={0.04}
          thickness={1.2}
          ior={1.491}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transparent
          opacity={0.35}
          color="#eaf2f5"
        />
      </RoundedBox>
    </group>
  );
}

export function LandSlab3D(props: Props) {
  return (
    <div className="h-full w-full" data-scene-ready>
      <SafeCanvas camera={{ position: [0, 0, 8.2], fov: 38 }} dpr={[1, 2]}>
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
