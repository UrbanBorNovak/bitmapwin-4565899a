import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { RelicDraft } from "@/lib/puzzle-relic";

const ORANGE = "#f7931a", CYAN = "#22e1ff", DIM = "#1c2330", BODY = "#0d1118";

/** Face text drawn to a canvas texture: exact match, hash, linked BITMAP. */
function faceTexture(d: RelicDraft, back: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = BODY; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = back ? CYAN : ORANGE; g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 246, 0, Math.PI * 2); g.stroke();
  g.textAlign = "center";
  g.fillStyle = d.proof === "server-verified" ? CYAN : "#7d8796";
  g.font = "bold 22px 'Space Mono', monospace";
  if (!back) {
    g.fillText(d.demo ? "DEMO · NOT A REAL FIND" : d.proof === "server-verified" ? "★ SERVER-VERIFIED" : "PROOF PENDING", 256, 96);
    g.fillStyle = ORANGE; g.font = "bold 120px 'Space Grotesk', sans-serif"; g.fillText(d.match, 256, 230);
    g.fillStyle = "#c9d1dc"; g.font = "20px 'Space Mono', monospace"; g.fillText("MATCHED HASH160 CHARS", 256, 268);
    g.fillStyle = "#7d8796"; g.font = "18px 'Space Mono', monospace"; g.fillText(`${d.hash.slice(0, 20)}…`, 256, 400);
    g.fillStyle = CYAN; g.fillText(d.bitmap ?? "NO BITMAP LINKED", 256, 432);
  } else {
    g.fillText("PUZZLE #71 · NEAR-MISS RELIC", 256, 110);
    g.fillStyle = "#c9d1dc"; g.font = "16px 'Space Mono', monospace";
    const lines = [`proof: ${d.proof}`, `bitmap: ${d.bitmap ?? "—"}`, `build: ${d.build ? d.build.slice(0, 14) + "…" : "—"}`, `guardian: ${d.guardian ? d.guardian.slice(0, 14) + "…" : "—"}`, d.hash.slice(0, 20), d.hash.slice(20)];
    lines.forEach((l, i) => g.fillText(l, 256, 190 + i * 34));
    g.fillStyle = "#7d8796"; g.fillText("prefix luck only · no payout", 256, 420);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Medallion({ draft, flip }: { draft: RelicDraft; flip: React.MutableRefObject<boolean> }) {
  const group = useRef<THREE.Group>(null);
  const diodes = useRef<THREE.InstancedMesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const front = useMemo(() => faceTexture(draft, false), [draft]);
  const back = useMemo(() => faceTexture(draft, true), [draft]);
  useEffect(() => () => { front.dispose(); back.dispose(); }, [front, back]);

  // 40 diodes on a ring between the rim and face text; first `nibbles` are lit.
  useEffect(() => {
    const m = diodes.current; if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const a = Math.PI / 2 - (i / 40) * Math.PI * 2;
      o.position.set(Math.cos(a) * 1.82, Math.sin(a) * 1.82, 0.13);
      o.rotation.set(0, 0, a); o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, new THREE.Color(i < draft.nibbles ? (i % 2 ? CYAN : ORANGE) : DIM));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [draft.nibbles]);

  useFrame((s, dt) => {
    const g = group.current; if (!g) return;
    const d = Math.min(dt, 0.05);
    const target = (flip.current ? Math.PI : 0) + s.pointer.x * 0.5;
    g.rotation.y += (target - g.rotation.y) * (1 - Math.exp(-6 * d));
    g.rotation.x += (-s.pointer.y * 0.35 - g.rotation.x) * (1 - Math.exp(-6 * d));
    if (core.current) core.current.rotation.y += d * 0.8;
  });

  const hasLand = !!draft.bitmap;
  return (
    <group ref={group}>
      <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[2.1, 2.1, 0.22, 64]} /><meshStandardMaterial color={BODY} metalness={0.8} roughness={0.35} /></mesh>
      <mesh><torusGeometry args={[2.1, 0.06, 12, 64]} /><meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.6} /></mesh>
      <mesh position-z={0.115}><circleGeometry args={[2.0, 64]} /><meshBasicMaterial map={front} /></mesh>
      <mesh position-z={-0.115} rotation-y={Math.PI}><circleGeometry args={[2.0, 64]} /><meshBasicMaterial map={back} /></mesh>
      <instancedMesh ref={diodes} args={[undefined, undefined, 40]}><boxGeometry args={[0.1, 0.18, 0.06]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
      {hasLand && (
        <mesh ref={core} position={[0, -0.55, 0.45]}>
          <boxGeometry args={[0.42, 0.42, 0.42]} />
          <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.5} wireframe={!draft.build} />
        </mesh>
      )}
    </group>
  );
}

/** Interactive preview of the badge a relic's Tag 11 viewer would draw. Tilt with the pointer, click to flip. */
export default function RelicBadge3D({ draft }: { draft: RelicDraft }) {
  const flip = useRef(false);
  return (
    <div className="h-64 w-full cursor-pointer rounded border border-border bg-background/60" onClick={() => { flip.current = !flip.current; }} data-relic-badge>
      <SafeCanvas camera={{ position: [0, 0, 6], fov: 40 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} />
        <pointLight position={[-3, -2, 3]} intensity={8} color={CYAN} />
        <Medallion draft={draft} flip={flip} />
      </SafeCanvas>
    </div>
  );
}
