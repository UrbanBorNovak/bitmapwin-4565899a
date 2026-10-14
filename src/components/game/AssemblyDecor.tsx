/**
 * THE CYPHERPUNK ASSEMBLY — extra chamber dressing for the genesis Shadow Gate.
 * Matrix opcode rain on the walls, a floating pyramid eye, the Council of 21
 * seats lit by the real passes taken, and the genesis hash ring on the floor.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeHtml } from "@/components/game/SafeHtml";
import { usePuppets } from "@/lib/game/puppets";
import { inscriptionContentUrl } from "@/lib/game/pfpExtenders";

const HALL = 26;
const GENESIS = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";
const GLYPHS = ["OP_DUP", "OP_HASH160", "OP_CHECKSIG", "OP_RETURN", "OP_EQUALVERIFY", "0x21", "SHA256", "SCHNORR", "y²=x³+7", "∅", "₿", "1", "0"];

function useRainTexture() {
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
  }, []);
  const drops = useRef<number[]>(Array.from({ length: 42 }, () => Math.random() * 256));
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (!tex) return;
    acc.current += dt;
    if (acc.current < 1 / 20) return;
    acc.current = 0;
    const c = tex.image as HTMLCanvasElement;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(2,4,8,0.18)";
    g.fillRect(0, 0, c.width, c.height);
    g.font = "11px monospace";
    drops.current.forEach((y, i) => {
      const glyph = GLYPHS[(Math.random() * GLYPHS.length) | 0]!;
      g.fillStyle = Math.random() < 0.06 ? "#f7931a" : i % 3 ? "#22d3ee" : "#34d399";
      g.fillText(glyph.length > 2 && Math.random() < 0.7 ? glyph[(Math.random() * glyph.length) | 0]! : glyph, i * 12.2, y);
      drops.current[i] = y > 256 + Math.random() * 120 ? 0 : y + 11;
    });
    tex.needsUpdate = true;
  });
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

function RainWalls() {
  const tex = useRainTexture();
  if (!tex) return null;
  const walls: [number, number, number][] = [
    [0, -HALL + 0.35, 0],
    [-HALL + 0.35, 0, Math.PI / 2],
    [HALL - 0.35, 0, -Math.PI / 2],
  ];
  return (
    <>
      {walls.map(([x, z, r], i) => (
        <mesh key={i} position={[x, 5, z]} rotation={[0, r, 0]}>
          <planeGeometry args={[HALL * 2 - 1, 9.6]} />
          <meshBasicMaterial map={tex} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function PyramidEye() {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) {
      g.current.rotation.y = t * 0.18;
      g.current.position.y = 7.4 + Math.sin(t * 0.6) * 0.15;
    }
    if (ring.current) {
      ring.current.rotation.x = t * 0.3;
      ring.current.rotation.z = t * 0.21;
    }
  });
  return (
    <group ref={g} position={[0, 7.4, 0]}>
      <mesh rotation-y={Math.PI / 4}>
        <coneGeometry args={[1.8, 2.4, 4, 1, true]} />
        <meshStandardMaterial color="#0a0910" emissive="#f7931a" emissiveIntensity={0.6} wireframe />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.32, 24, 16]} />
        <meshStandardMaterial color="#020205" emissive="#f7931a" emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.55, 0.03, 8, 48]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      <group ref={ring}>
        {[2.6, 3.2].map((r, i) => (
          <mesh key={r} rotation-x={i ? Math.PI / 2 : 0}>
            <torusGeometry args={[r, 0.015, 6, 96]} />
            <meshBasicMaterial color={i ? "#22d3ee" : "#f7931a"} transparent opacity={0.7} toneMapped={false} />
          </mesh>
        ))}
        <mesh>
          <octahedronGeometry args={[3.6, 0]} />
          <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.18} />
        </mesh>
      </group>
      {/* the light falling on the altar */}
      <mesh position={[0, -3.6, 0]}>
        <coneGeometry args={[2.4, 6, 32, 1, true]} />
        <meshBasicMaterial color="#f7931a" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight color="#f7931a" intensity={22} distance={18} />
    </group>
  );
}

/** Real Emporium inscription image as a crisp pixel texture on the seat's backrest. */
function DelegatePortrait({ id, lit }: { id: string; lit: boolean }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(inscriptionContentUrl(id), (t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      loaded = t;
      if (alive) setTex(t);
      else t.dispose();
    });
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, [id]);
  return (
    <group position={[0, 1.5, 0.43]}>
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[0.74, 0.74]} />
        <meshBasicMaterial color={lit ? "#f7931a" : "#0e7490"} toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[0.68, 0.68]} />
        {tex ? (
          <meshBasicMaterial map={tex} toneMapped={false} color={lit ? "#ffffff" : "#9aa4ad"} />
        ) : (
          <meshBasicMaterial color="#05040a" />
        )}
      </mesh>
    </group>
  );
}

const EMPORIUM_PORTRAITS = 2574;

function Council({ taken, max }: { taken: number; max: number }) {
  const seats = Math.max(1, Math.min(max, 64));
  const glow = useRef<THREE.MeshStandardMaterial[]>([]);
  // Each seat is held by a real Bitmap Emporium child of 717328.bitmap, spread evenly across the pool.
  const pool = usePuppets();
  const delegates = useMemo(() => {
    // Only the first 2,574 children of 717328 are Emporium portraits (image/png);
    // later children are text parcel inscriptions (e.g. "1168.717328.bitmap").
    const list = (pool?.list ?? []).slice(0, EMPORIUM_PORTRAITS);
    if (!list.length) return [] as typeof list;
    const step = Math.max(1, Math.floor(list.length / seats));
    return Array.from({ length: seats }, (_, i) => list[(i * step) % list.length]!);
  }, [pool, seats]);
  useFrame(({ clock }) => {
    glow.current.forEach((m, i) => {
      if (!m) return;
      m.emissiveIntensity = i < taken ? 1.3 + Math.sin(clock.elapsedTime * 2 + i) * 0.3 : 0.15 + Math.sin(clock.elapsedTime * 0.8 + i) * 0.1;
    });
  });
  return (
    <group>
      {Array.from({ length: seats }, (_, i) => {
        const a = (i / seats) * Math.PI * 2;
        const r = 7.2;
        const lit = i < taken;
        return (
          <group key={i} position={[Math.sin(a) * r, 0, Math.cos(a) * r]} rotation={[0, a + Math.PI, 0]}>
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.8, 0.9, 0.8]} />
              <meshStandardMaterial color="#0a0910" roughness={0.25} metalness={0.6} />
            </mesh>
            <mesh position={[0, 1.4, 0.36]}>
              <boxGeometry args={[0.8, 1.9, 0.12]} />
              <meshStandardMaterial
                ref={(m) => { if (m) glow.current[i] = m; }}
                color="#05040a"
                emissive={lit ? "#f7931a" : "#22d3ee"}
                emissiveIntensity={0.3}
              />
            </mesh>
            {delegates[i] && <DelegatePortrait id={delegates[i]!.inscriptionId} lit={lit} />}
            <SafeHtml position={[0, 2.7, 0]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
              <div className={`whitespace-nowrap text-center font-mono text-[8px] ${lit ? "text-bitcoin" : "text-signal/50"}`}>
                {String(i + 1).padStart(2, "0")}
                {delegates[i] && <div className="text-[6px] opacity-80">EMPORIUM #{delegates[i]!.index + 1} · 717328</div>}
              </div>
            </SafeHtml>
          </group>
        );
      })}
    </group>
  );
}

function GenesisRing() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.03;
  });
  const chars = GENESIS.split("");
  return (
    <group ref={ref}>
      {[4.6, 9.4].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <ringGeometry args={[r, r + 0.06, 128]} />
          <meshBasicMaterial color="#f7931a" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      ))}
      <SafeHtml position={[0, 0.05, 5.4]} center transform rotation-x={-Math.PI / 2} distanceFactor={6} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap font-mono text-[10px] tracking-[0.25em] text-bitcoin/80">
          {chars.join("")}
        </div>
      </SafeHtml>
    </group>
  );
}

function Memorials() {
  const lines = [
    { t: "CHANCELLOR ON BRINK OF SECOND BAILOUT FOR BANKS", p: [0, 8.6, -HALL + 0.8] as const, r: 0 },
    { t: "CYPHERPUNKS WRITE CODE", p: [-HALL + 0.8, 8.2, 0] as const, r: Math.PI / 2 },
    { t: "ZERO KNOWLEDGE · NO MASTERS", p: [HALL - 0.8, 8.2, 0] as const, r: -Math.PI / 2 },
    { t: "THE EMPORIUM DELEGATES · 717328.BITMAP · NO NAMES, ONLY KEYS", p: [0, 9.4, -HALL + 0.8] as const, r: 0 },
  ];
  return (
    <>
      {lines.map((l) => (
        <SafeHtml key={l.t} position={l.p as unknown as [number, number, number]} rotation-y={l.r} transform distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap border-y border-bitcoin/40 px-4 py-1 font-mono text-[14px] tracking-[0.35em] text-bitcoin">
            {l.t}
          </div>
        </SafeHtml>
      ))}
    </>
  );
}

export function AssemblyDecor({ taken, max }: { taken: number; max: number }) {
  return (
    <group>
      <RainWalls />
      <PyramidEye />
      <Council taken={taken} max={max} />
      <GenesisRing />
      <Memorials />
    </group>
  );
}
