import { useEffect, useMemo, useRef, useState } from "react";
import { events as r3fEvents, useFrame, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { SafeHtml } from "@/components/game/SafeHtml";
import { GENESIS_BROADCASTER as G } from "@/lib/genesis-broadcaster";
import { resolvePixelTexture } from "@/lib/pixel-texture";
import { hairFor, seatPlace, type LaunchSeat } from "@/lib/launch-seats";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import type { SponsorSlide } from "@/lib/sponsor-slots.functions";

const ROWS = 24;
const STEP_H = 0.55;
const STEP_D = 1.1;
const SEAT_W = 0.9;

/** Seat world position on the stepped arc grandstand. */
function seatPos(seat: number): [number, number, number, number] {
  const { row, col, perRow } = seatPlace(seat);
  const radius = 8 + row * STEP_D;
  const spread = (perRow * SEAT_W) / radius;
  const a = -spread / 2 + (col + 0.5) * (spread / perRow);
  return [Math.sin(a) * radius, row * STEP_H + STEP_H / 2, Math.cos(a) * radius, a];
}

/** Stepped stands: one instanced block per seat, each reaching down to the ground (no solid wedge across the stage). */
function Stands() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const total = useMemo(() => { let n = 0; for (let r = 0; r < ROWS; r++) n += 12 + 2 * r; return n; }, []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D(); const c = new THREE.Color();
    for (let i = 0; i < total; i++) {
      const [x, y, z, a] = seatPos(i + 1);
      const top = y; // seat surface
      o.position.set(x, top / 2, z); o.rotation.set(0, a, 0); o.scale.set(SEAT_W, top, STEP_D);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(seatPlace(i + 1).row % 2 ? "#4a4f5a" : "#3a3e47"));
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [total]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, total]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

/** Page-size CSS zoom skews default R3F picking; map the pointer with client/rect ratios instead. */
const zoomSafeEvents = (store: Parameters<typeof r3fEvents>[0]) => ({
  ...r3fEvents(store),
  compute(e: { clientX: number; clientY: number }, state: RootState) {
    const r = state.gl.domElement.getBoundingClientRect();
    state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.raycaster.setFromCamera(state.pointer, state.camera);
  },
});

const faceCache = new Map<string, THREE.Texture>();
function useFace(pixelId: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let live = true;
    resolvePixelTexture(pixelId).then((id) => {
      if (!live || !id) return;
      let t = faceCache.get(id);
      if (!t) {
        t = new THREE.TextureLoader().load(`/api/public/inscription/${id}`);
        t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        t.repeat.set(1 / 8, 1 / 8); t.offset.set(1 / 8, 1 - 2 / 8); // face front tile (1,1)
        faceCache.set(id, t);
      }
      setTex(t);
    });
    return () => { live = false; };
  }, [pixelId]);
  return tex;
}

function hue(address: string) {
  let h = 0; for (const c of address) h = (h * 31 + c.charCodeAt(0)) % 360;
  return new THREE.Color().setHSL(h / 360, 0.45, 0.45);
}

/** Orange banner carrying the held BITMAP number, drawn to a canvas (no font download). */
function FlagBanner({ height }: { height: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f7931a"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#0d0f13"; g.font = "bold 52px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(height), 128, 56); g.font = "bold 26px monospace"; g.fillText(".bitmap", 128, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [height]);
  return (
    <mesh position={[0.36, 1.75, 0]}>
      <planeGeometry args={[0.72, 0.36]} />
      <meshBasicMaterial map={tex} side={THREE.FrontSide} />
    </mesh>
  );
}

const HAIR_COLOR = ["#2a1a10", "#6b3a1a", "#d9a441", "#b23a1a", "#e8e0d0", "#1a1a2a"];
function Hair({ seat }: { seat: LaunchSeat }) {
  const style = hairFor(seat.heldBitmap, seat.clubHair ?? null);
  const c = style === "genesis-crown" ? "#f5c518" : HAIR_COLOR[seat.seat % HAIR_COLOR.length]!;
  const m = <meshLambertMaterial color={c} />;
  if (style === "shaved") return null;
  if (style === "marauder-hawk") return (<>
    {[-0.18, -0.06, 0.06, 0.18].map((z) => <mesh key={z} position={[0, 1.3 - Math.abs(z) * 0.4, z]}><boxGeometry args={[0.1, 0.26, 0.11]} /><meshLambertMaterial color="#d61f1f" emissive="#3a0000" /></mesh>)}
  </>);
  if (style === "emporium-bob") return (<>
    <mesh position-y={1.19}><boxGeometry args={[0.56, 0.1, 0.56]} /><meshLambertMaterial color="#8a5cf6" /></mesh>
    {[-0.29, 0.29].map((x) => <mesh key={x} position={[x, 0.95, 0]}><boxGeometry args={[0.07, 0.4, 0.52]} /><meshLambertMaterial color="#8a5cf6" /></mesh>)}
  </>);
  if (style === "genesis-crown") return (<>
    <mesh position-y={1.18}><boxGeometry args={[0.52, 0.08, 0.52]} />{m}</mesh>
    {[-0.18, 0, 0.18].map((x) => <mesh key={x} position={[x, 1.3, 0]}><boxGeometry args={[0.1, 0.18, 0.1]} /><meshLambertMaterial color={c} emissive="#5a3a00" /></mesh>)}
  </>);
  if (style === "satoshi-mullet") return (<>
    <mesh position-y={1.19}><boxGeometry args={[0.54, 0.1, 0.54]} />{m}</mesh>
    <mesh position={[0, 0.85, -0.27]}><boxGeometry args={[0.5, 0.45, 0.08]} />{m}</mesh>
  </>);
  if (style === "pizza-spikes") return (<>
    {[[-0.15, -0.12], [0.15, -0.12], [0, 0.05], [-0.15, 0.15], [0.15, 0.15]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x!, 1.25, z!]}><coneGeometry args={[0.09, 0.22, 4]} />{m}</mesh>)}
  </>);
  return <mesh position-y={1.17}><boxGeometry args={[0.52, 0.06, 0.52]} />{m}</mesh>;
}
function Hat({ id }: { id: string }) {
  if (id === "top-hat") return (<><mesh position-y={1.2}><boxGeometry args={[0.6, 0.04, 0.6]} /><meshLambertMaterial color="#111" /></mesh><mesh position-y={1.42}><boxGeometry args={[0.38, 0.4, 0.38]} /><meshLambertMaterial color="#111" /></mesh></>);
  if (id === "cowboy") return (<><mesh position-y={1.2}><boxGeometry args={[0.75, 0.04, 0.75]} /><meshLambertMaterial color="#8a5a2a" /></mesh><mesh position-y={1.32}><boxGeometry args={[0.4, 0.2, 0.4]} /><meshLambertMaterial color="#8a5a2a" /></mesh></>);
  if (id === "beanie") return <mesh position-y={1.22}><boxGeometry args={[0.54, 0.18, 0.54]} /><meshLambertMaterial color="#f7931a" /></mesh>;
  if (id === "crown") return (<>{[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, 0]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x!, 1.28, z!]}><boxGeometry args={[0.1, 0.2, 0.1]} /><meshLambertMaterial color="#f5c518" emissive="#5a3a00" /></mesh>)}<mesh position-y={1.18}><boxGeometry args={[0.52, 0.06, 0.52]} /><meshLambertMaterial color="#f5c518" /></mesh></>);
  return null;
}
function Snack({ id }: { id: string }) {
  const at: [number, number, number] = [0.32, 0.45, 0.22];
  if (id === "pizza") return <mesh position={at} rotation-x={-0.5}><coneGeometry args={[0.13, 0.25, 3]} /><meshLambertMaterial color="#f2b04a" /></mesh>;
  if (id === "coffee") return <mesh position={at}><cylinderGeometry args={[0.07, 0.06, 0.16, 8]} /><meshLambertMaterial color="#e8e0d0" /></mesh>;
  if (id === "popcorn") return (<group position={at}><mesh><cylinderGeometry args={[0.1, 0.07, 0.18, 8]} /><meshLambertMaterial color="#d62828" /></mesh><mesh position-y={0.1}><sphereGeometry args={[0.1, 6, 4]} /><meshLambertMaterial color="#fff3b0" /></mesh></group>);
  if (id === "donut") return <mesh position={at} rotation-x={Math.PI / 2}><torusGeometry args={[0.08, 0.04, 6, 10]} /><meshLambertMaterial color="#e86aa0" /></mesh>;
  return null;
}

function Bitmapper({ seat, mine, selected, onPick }: { seat: LaunchSeat; mine: boolean; selected: boolean; onPick: (s: LaunchSeat) => void }) {
  const face = useFace(seat.pixelId);
  const [x, y, z, a] = seatPos(seat.seat);
  const zombie = !!seat.member;
  const body = useMemo(() => (seat.member ? "#2f4a33" : hue(seat.address)), [seat.address, seat.member]);
  const skin = zombie ? "#7fa36a" : "#c9a27a";
  const g = useRef<THREE.Group>(null);
  const phase = seat.seat * 0.7;
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = y + Math.max(0, Math.sin(clock.elapsedTime * 2 + phase)) * (selected ? 0.25 : 0.05);
  });
  return (
    <group ref={g} position={[x, y, z]} rotation-y={a + Math.PI} onClick={(e) => { e.stopPropagation(); onPick(seat); }}>
      <mesh position-y={0.35}><boxGeometry args={[0.5, 0.55, 0.32]} /><meshLambertMaterial color={body} /></mesh>
      {zombie && <mesh rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.3, 0.42, 16]} /><meshBasicMaterial color="#4ade80" transparent opacity={0.7} /></mesh>}
      {zombie && [-0.3, 0.3].map((dx) => <mesh key={dx} position={[dx, 0.55, 0.3]}><boxGeometry args={[0.1, 0.1, 0.45]} /><meshLambertMaterial color={skin} /></mesh>)}
      <mesh position-y={0.9}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        {[0, 1, 2, 3].map((i) => <meshLambertMaterial key={i} attach={`material-${i}`} color={skin} />)}
        <meshLambertMaterial attach="material-4" map={face} color={face ? (zombie ? "#a8e6a0" : "#ffffff") : skin} />
        <meshLambertMaterial attach="material-5" color={skin} />
      </mesh>
      {seat.gear?.includes("ancient") && (<>
        <mesh position={[0, 1.02, 0.26]}><boxGeometry args={[0.52, 0.1, 0.04]} /><meshLambertMaterial color="#6b4a2a" /></mesh>
        {[-0.12, 0.12].map((x) => <mesh key={x} position={[x, 1.02, 0.29]}><boxGeometry args={[0.13, 0.13, 0.05]} /><meshLambertMaterial color="#c08a3e" emissive="#3a2208" /></mesh>)}
      </>)}
      {seat.gear?.includes("founder") && (
        <mesh position={[0, 0.92, 0.27]}><boxGeometry args={[0.46, 0.09, 0.03]} /><meshBasicMaterial color="#22d3ee" /></mesh>
      )}
      {!seat.hat && !seat.gear?.includes("builder") && <Hair seat={seat} />}
      {seat.hat && <Hat id={seat.hat} />}
      {seat.food && <Snack id={seat.food} />}
      {!seat.hat && seat.gear?.includes("builder") && (
        <mesh position-y={1.2}><boxGeometry args={[0.56, 0.12, 0.56]} /><meshLambertMaterial color="#f5c518" /></mesh>
      )}
      {seat.gear?.includes("tamer") && (
        <group position={[-0.4, 0.12, 0.15]}>
          <mesh><boxGeometry args={[0.22, 0.2, 0.3]} /><meshLambertMaterial color="#8fd16a" /></mesh>
          <mesh position={[0, 0.16, 0.12]}><boxGeometry args={[0.16, 0.16, 0.16]} /><meshLambertMaterial color="#8fd16a" /></mesh>
        </group>
      )}
      {seat.heldBitmap !== null && (
        <group position={[0.34, 0, 0.1]}>
          <mesh position-y={1.2}><boxGeometry args={[0.05, 1.5, 0.05]} /><meshLambertMaterial color="#d8d8d8" /></mesh>
          <FlagBanner height={seat.heldBitmap} />
        </group>
      )}
      {(mine || selected) && (
        <mesh position-y={2.4}><cylinderGeometry args={[0.04, 0.04, 2.2]} /><meshBasicMaterial color={mine ? "#22d3ee" : "#f7931a"} transparent opacity={0.8} /></mesh>
      )}
    </group>
  );
}

function Stage() {
  return (
    <group position={[0, 0, 2]} rotation-y={Math.PI}>
      <mesh position-y={0.2}><boxGeometry args={[6, 0.4, 2.4]} /><meshLambertMaterial color="#2a2d34" /></mesh>
      <mesh position={[0, 1.6, -0.9]}><boxGeometry args={[5.6, 2.4, 0.2]} /><meshLambertMaterial color="#f7931a" emissive="#5a2d00" /></mesh>
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 1.2, 0.8]}><boxGeometry args={[0.25, 2, 0.25]} /><meshLambertMaterial color="#22d3ee" emissive="#0a4a55" /></mesh>
      ))}
      {/* Line-array speaker stacks flanking the screen. */}
      {[-5, 5].map((x) => (
        <group key={`spk${x}`} position={[x, 0, -0.6]}>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} position-y={0.45 + i * 0.85}>
              <mesh><boxGeometry args={[1.1, 0.8, 0.9]} /><meshLambertMaterial color="#15181d" /></mesh>
              <mesh position-z={-0.46}><circleGeometry args={[0.3, 10]} /><meshLambertMaterial color="#2c3138" side={THREE.DoubleSide} /></mesh>
            </group>
          ))}
          <mesh position={[0, 3.85, -0.46]}><boxGeometry args={[1.1, 0.05, 0.02]} /><meshBasicMaterial color="#22d3ee" /></mesh>
        </group>
      ))}
      {/* Goal-post truss cradling the video wall. */}
      {[-4.55, 4.55].map((x) => (
        <mesh key={`tr${x}`} position={[x, 3.6, -1.1]}><boxGeometry args={[0.22, 7.2, 0.22]} /><meshLambertMaterial color="#5a606a" /></mesh>
      ))}
      <mesh position={[0, 7.1, -1.1]}><boxGeometry args={[9.3, 0.22, 0.22]} /><meshLambertMaterial color="#5a606a" /></mesh>
    </group>
  );
}

/** Biternam-style light trusses and antenna towers ringing the arena. */
function Trusses() {
  const spots = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = -1.3 + (i / 13) * 2.6;
    return [Math.sin(a) * 38, Math.cos(a) * 38, a] as const;
  }), []);
  return <>{spots.map(([x, z, a], i) => (
    <group key={i} position={[x, 0, z]} rotation-y={a}>
      {[-0.5, 0.5].map((dx) => <mesh key={dx} position={[dx, 7, 0]}><boxGeometry args={[0.18, 14, 0.18]} /><meshLambertMaterial color="#3a3e47" /></mesh>)}
      {[3, 7, 11].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1.2, 0.14, 0.14]} /><meshLambertMaterial color="#4a4f5a" /></mesh>)}
      <mesh position={[0, 14.4, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshBasicMaterial color={i % 2 ? "#22d3ee" : "#f7931a"} /></mesh>
    </group>
  ))}</>;
}

/** Neon rim strip along the front edge of every tier row (one instanced mesh). */
function NeonTiers() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const total = useMemo(() => { let n = 0; for (let r = 0; r < ROWS; r++) n += 12 + 2 * r; return n; }, []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D(); const c = new THREE.Color();
    for (let i = 0; i < total; i++) {
      const [x, y, z, a] = seatPos(i + 1);
      const { row } = seatPlace(i + 1);
      const r = Math.hypot(x, z); const k = (r - STEP_D / 2 + 0.02) / r;
      o.position.set(x * k, y + 0.02, z * k); o.rotation.set(0, a, 0); o.scale.set(SEAT_W, 0.06, 0.06);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      // Founders Row (#1-#100) orange, rest cyan
      m.setColorAt(i, c.set(i < 100 ? "#f7931a" : row % 4 === 0 ? "#22d3ee" : "#145f6b"));
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [total]);
  return <instancedMesh ref={ref} args={[undefined, undefined, total]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial /></instancedMesh>;
}

/** Stage spotlight beams: additive cones sweeping slowly (no real lights, cheap). */
function Beams() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => { c.rotation.z = Math.sin(clock.elapsedTime * 0.4 + i * 1.7) * 0.35; });
  });
  return (
    <group ref={g}>
      {[-3, -1, 1, 3].map((x, i) => (
        <group key={x} position={[x, 0.4, 1.2]}>
          <mesh position-y={9} rotation-x={0.35}>
            <coneGeometry args={[2.2, 18, 12, 1, true]} />
            <meshBasicMaterial color={i % 2 ? "#22d3ee" : "#f7931a"} transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Rising voxel motes caught in the beams (single Points). */
function Motes() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const p = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) { p[i * 3] = (Math.random() - 0.5) * 40; p[i * 3 + 1] = Math.random() * 16; p[i * 3 + 2] = Math.random() * 36 - 4; }
    return p;
  }, []);
  useFrame((_, d) => {
    const a = ref.current?.geometry.attributes["position"] as THREE.BufferAttribute | undefined; if (!a) return;
    for (let i = 0; i < 300; i++) { let y = a.getY(i) + d * 0.6; if (y > 16) y = 0; a.setY(i, y); }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
      <pointsMaterial color="#9fe9f5" size={0.12} transparent opacity={0.6} depthWrite={false} />
    </points>
  );
}

/** Stage jumbotron: CRT-style canvas showing the inspected Bitmapper. */
function useSponsorImage(slide: SponsorSlide | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImg(null); if (!slide) return;
    const i = new Image(); i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = slide.kind === "inscription" ? `https://ordinals.com/content/${slide.media}` : slide.media;
    return () => { i.onload = null; };
  }, [slide]);
  return img;
}

function Jumbotron({ seat, sponsors = [] }: { seat: LaunchSeat | null; sponsors?: SponsorSlide[] }) {
  const face = useFace(seat?.pixelId ?? "");
  const [tick, setTick] = useState(0);
  useEffect(() => { if (seat || !sponsors.length) return; const t = setInterval(() => setTick((x) => x + 1), 8000); return () => clearInterval(t); }, [seat, sponsors.length]);
  const ad = !seat && sponsors.length ? sponsors[tick % sponsors.length]! : null;
  const adImg = useSponsorImage(ad);
  const { tex, canvas } = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    return { tex: t, canvas: c };
  }, []);
  useEffect(() => {
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#06090d"; g.fillRect(0, 0, 512, 256);
    g.fillStyle = "#22d3ee"; g.font = "bold 22px monospace"; g.fillText("BITMAPWIN · LAUNCH FEED", 20, 36);
    if (ad) {
      g.fillStyle = "#f7931a"; g.font = "bold 18px monospace"; g.fillText("● SPONSORED BROADCAST", 20, 64);
      if (adImg) { try { const k = Math.min(180 / adImg.width, 180 / adImg.height); g.drawImage(adImg, 492 - adImg.width * k, 48, adImg.width * k, adImg.height * k); } catch { /* tainted */ } }
      g.fillStyle = "#ffffff"; g.font = "bold 34px monospace"; g.fillText(ad.title.slice(0, 16), 20, 130);
      g.fillStyle = "#22d3ee"; g.font = "20px monospace"; if (ad.handle) g.fillText(ad.handle.slice(0, 22), 20, 170);
      g.fillStyle = "rgba(0,0,0,0.35)"; for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 512, 2);
      tex.needsUpdate = true; return;
    }
    g.fillStyle = "#f7931a"; g.font = "bold 64px monospace";
    g.fillText(seat ? `SEAT #${seat.seat}` : "STAND BY", 20, 120);
    g.fillStyle = "#cfd6df"; g.font = "20px monospace";
    if (seat) {
      g.fillText(`${seat.address.slice(0, 10)}…${seat.address.slice(-6)}`, 20, 160);
      g.fillText(seat.seat <= 100 ? "FOUNDERS ROW" : seat.seat <= 500 ? "FULL HOUSE" : "IGNITION", 20, 192);
      if (seat.heldBitmap !== null) { g.fillStyle = "#f7931a"; g.fillText(`FLAG ${seat.heldBitmap}.bitmap`, 20, 224); }
    } else g.fillText("TAP A BITMAPPER", 20, 170);
    g.fillStyle = "rgba(0,0,0,0.35)"; for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 512, 2);
    tex.needsUpdate = true;
  }, [seat, canvas, tex, ad, adImg]);
  return (
    <group position={[0, 0.82, 3.26]} scale={0.46}>
      <mesh><planeGeometry args={[5.2, 2.6]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      {seat && face && <mesh position={[1.95, 0.05, 0.01]}><planeGeometry args={[1.05, 1.05]} /><meshBasicMaterial map={face} toneMapped={false} /></mesh>}
    </group>
  );
}

/** Big stage video wall above the jumbotron: Elevated Dabber's live bitmap.stream channel, watched by the whole stand. */
function StageVideo() {
  const w = 8.6, h = w * 9 / 16, z = 3.05;
  const [front, setFront] = useState(true);
  // Only the audience side (+z) sees the stream; from backstage the DOM layer is removed.
  useFrame(({ camera }) => {
    const f = camera.position.z > z + 0.05;
    if (f !== front) setFront(f);
  });
  return (
    <group position={[0, 1.5 + h / 2, z]}>
      <mesh position-z={-0.04}><boxGeometry args={[w + 0.16, h + 0.16, 0.06]} /><meshLambertMaterial color="#1a1410" emissive="#5a2d00" /></mesh>
      {/* Rear chassis: opaque LED-wall back with ribs and cable conduits. */}
      <mesh position-z={-0.22}><boxGeometry args={[w + 0.1, h + 0.1, 0.3]} /><meshLambertMaterial color="#202328" /></mesh>
      {[-3.4, -1.2, 1.2, 3.4].map((x) => (
        <mesh key={x} position={[x, 0, -0.42]}><boxGeometry args={[0.12, h + 0.3, 0.12]} /><meshLambertMaterial color="#3a3f47" /></mesh>
      ))}
      {[-0.6, 0.6].map((y) => (
        <mesh key={y} position={[0, y, -0.4]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.04, 0.04, w - 0.4, 6]} /><meshLambertMaterial color="#111" /></mesh>
      ))}
      {front && <SafeHtml transform distanceFactor={400} position={[0, 0, 0.005]} scale={w / 640} zIndexRange={[1, 0]} style={{ backfaceVisibility: "hidden" }}>
        <div style={{ width: 640, height: 360, background: "#000", position: "relative", overflow: "hidden", font: "12px monospace" }}>
          <iframe src={G.embedUrl} title="Elevated Dabber live on bitmap.stream" width={640} height={360} style={{ border: 0, display: "block" }} allow="autoplay; fullscreen" />
          <div style={{ position: "absolute", top: 6, left: 10, color: "#f7931a", pointerEvents: "none", textShadow: "0 0 4px #000" }}>● LIVE · @{G.handle} · {G.channelHeight}.BITMAP</div>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 2px, transparent 2px 4px)" }} />
        </div>
      </SafeHtml>}
    </group>
  );
}

export type GrandstandView = "diorama" | "stage" | "seat";

export default function LaunchGrandstand3D({ seats, myAddress, selected, onPick, focusSeat, view = "diorama", mySeat = null, sponsors = [], popcornThrows = 0, onPopcornHit }: {
  seats: LaunchSeat[]; myAddress: string | null; selected: number | null; onPick: (s: LaunchSeat) => void; focusSeat: number | null;
  view?: GrandstandView; mySeat?: number | null; sponsors?: SponsorSlide[]; popcornThrows?: number; onPopcornHit?: () => void;
}) {
  const picked = seats.find((s) => s.seat === selected) ?? null;
  return (
    <SafeCanvas events={zoomSafeEvents} camera={{ position: [0, 10, -6], fov: 55 }} dpr={[1, 1.5]}>
      <color attach="background" args={["#07090d"]} />
      <fog attach="fog" args={["#07090d", 28, 64]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 14, -8]} intensity={1.3} />
      <hemisphereLight args={["#9fb6ff", "#2a1a0a", 0.4]} />
      <CameraRig focus={focusSeat} view={view} mySeat={mySeat} showScreen={!!picked} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}><planeGeometry args={[120, 120]} /><meshLambertMaterial color="#14171c" /></mesh>
      <Stands /><NeonTiers /><Stage /><Trusses /><Beams /><Motes />
      <Jumbotron seat={picked} sponsors={sponsors} />
      <StageVideo />
      {STAFF.map((c, i) => <StaffWalker key={c.id} ins={c.ins} i={i} />)}
      <PopcornLayer throws={popcornThrows} fromSeat={mySeat} onHit={onPopcornHit} />
      {seats.map((s) => (
        <Bitmapper key={s.seat} seat={s} mine={!!myAddress && s.address.toLowerCase() === myAddress.toLowerCase()} selected={selected === s.seat} onPick={onPick} />
      ))}
    </SafeCanvas>
  );
}

type Kernel = { p: THREE.Vector3; v: THREE.Vector3; t: number; hit: boolean };
/** Popcorn throws: kernels arc from the thrower's seat to the stage screen; hits splat and report back. */
function PopcornLayer({ throws, fromSeat, onHit }: { throws: number; fromSeat: number | null; onHit?: (() => void) | undefined }) {
  const N = 40;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const ks = useRef<Kernel[]>([]);
  const last = useRef(throws);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, raw) => {
    const d = Math.min(raw, 0.05);
    if (throws !== last.current && fromSeat) {
      last.current = throws;
      const [x, y, z] = seatPos(fromSeat);
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Vector3(x * 0.94, y + 1.4, z * 0.94);
        const aim = new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 4, 3.1);
        const T = 1.1;
        const v = aim.sub(p).divideScalar(T); v.y += 0.5 * 9.8 * T;
        ks.current.push({ p, v, t: 0, hit: false });
      }
      ks.current = ks.current.slice(-N);
    }
    const im = mesh.current; if (!im) return;
    let i = 0;
    for (const k of ks.current) {
      k.t += d;
      if (!k.hit) {
        k.v.y -= 9.8 * d; k.p.addScaledVector(k.v, d);
        if (k.p.z <= 3.12 && Math.abs(k.p.x) < 4.3 && k.p.y > 1.5 && k.p.y < 6.4) { k.hit = true; k.p.z = 3.12; k.t = 0; onHit?.(); }
      } else if (k.t > 0.6) { k.p.y -= 3 * d; }
      const s = k.hit ? 0.22 : 0.09;
      m.makeScale(s, s, k.hit ? 0.02 : s).setPosition(k.p); im.setMatrixAt(i++, m);
    }
    ks.current = ks.current.filter((k) => !(k.hit && k.p.y < 0.4) && k.p.y > -1);
    for (; i < N; i++) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); }
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, N]}><boxGeometry /><meshBasicMaterial color="#ffe28a" /></instancedMesh>;
}

/** STAFF: the Biternam crew, wearing the same on-chain Pixel faces they wear in Biternam rooms. */
const STAFF = [
  { id: "dev9", ins: CREW_PIXEL_AVATAR["dev9"]! },
  { id: "anchorman", ins: "11e0423355a75b615977f7da49f33f140c68c825f94caacb28762cbd7c8cec26i0" }, // OG Anchorman @BitMap_News #1
  { id: "tornado", ins: CREW_PIXEL_AVATAR["tornado"]! },
  { id: "bitty", ins: CREW_PIXEL_AVATAR["bitlodo"]! }, // Roaring Bitty - 9
  { id: "bop", ins: CREW_PIXEL_AVATAR["bop"]! },
  { id: "dabber", ins: CREW_PIXEL_AVATAR["dabber"]! },
  { id: "mr-shiddy", ins: CREW_PIXEL_AVATAR["mr-shiddy"]! },
  { id: "wierdamoto", ins: CREW_PIXEL_AVATAR["wierdamoto"]! },
];
function StaffWalker({ ins, i }: { ins: string; i: number }) {
  const g = useRef<THREE.Group>(null);
  const moving = useRef(true);
  useFrame(({ clock }) => {
    const o = g.current; if (!o) return;
    const t = clock.elapsedTime * 0.12 + i * 1.7;
    const r = 5.6 + (i % 2) * 0.9, a = Math.sin(t) * 1.15;
    const x = Math.sin(a) * r, z = 3.6 + Math.cos(a) * (r - 3.6);
    const da = Math.cos(t) * 0.12;
    const dx = Math.cos(a) * r * da, dz = -Math.sin(a) * (r - 3.6) * da;
    o.position.set(x, 0, z);
    moving.current = Math.hypot(dx, dz) > 0.02;
    if (Math.hypot(dx, dz) > 1e-4) o.rotation.y = Math.atan2(dx, dz);
  });
  const fallback = <mesh position-y={0.6}><boxGeometry args={[0.45, 1.2, 0.3]} /><meshLambertMaterial color="#1b1f26" /></mesh>;
  return (
    <group ref={g}>
      {/* The inscribed on-chain avatar rig wearing this crew member's BITMAP Pixel skin, as in Biternam. */}
      <ToonPixelRig inscriptionId={ins} pose="idle" movingRef={moving} fallback={fallback} />
      <mesh position-y={1.38}><boxGeometry args={[0.42, 0.08, 0.42]} /><meshLambertMaterial color="#f7931a" /></mesh>
    </group>
  );
}

function CameraRig({ focus, view, mySeat, showScreen }: { focus: number | null; view: GrandstandView; mySeat: number | null; showScreen: boolean }) {
  const target = useRef(new THREE.Vector3(0, 3, 13));
  const eye = useRef(new THREE.Vector3(0, 10, -6));
  useFrame(({ camera, clock }, d) => {
    let fov = 50;
    if (view === "seat" && mySeat) {
      // Sit in my seat: eye at head height, looking at the stage.
      const [x, y, z] = seatPos(mySeat);
      eye.current.set(x * 0.94, y + 1.7, z * 0.94); target.current.set(0, 3.2, 3); fov = 60;
    } else if (focus) {
      const [x, y, z] = seatPos(focus);
      target.current.set(x, y + 0.8, z);
      // Stand between the stage and the seat, above the stage backdrop, so nothing blocks the view.
      const pull = Math.max(0.55, 1 - 5 / Math.hypot(x, z));
      eye.current.set(x * pull, y + 6, z * pull);
    } else if (view === "stage" && showScreen) {
      // A Bitmapper is picked: face the jumbotron from the open floor in front of the stands.
      const t = clock.elapsedTime * 0.2;
      eye.current.set(Math.sin(t) * 1, 6.5, 12.5); target.current.set(0, 1.2, 3); fov = 55;
    } else if (view === "stage") {
      const t = clock.elapsedTime * 0.15;
      eye.current.set(Math.sin(t) * 3, 5, -3); target.current.set(0, 5, 16); fov = 55;
    } else {
      // Biternam 2.5D diorama: fixed high tilted angle, narrow lens.
      eye.current.set(-22, 30, -18); target.current.set(0, 4, 12); fov = 32;
    }
    const k = 1 - Math.exp(-3 * Math.min(d, 0.05));
    const pc = camera as THREE.PerspectiveCamera;
    if (Math.abs(pc.fov - fov) > 0.1) { pc.fov += (fov - pc.fov) * k; pc.updateProjectionMatrix(); }
    camera.position.lerp(eye.current, k);
    camera.lookAt(target.current);
  });
  return null;
}
