import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import { Box3, CanvasTexture, SRGBColorSpace, Vector3, type Group, type Sprite } from "three";

/** Measured world height of each cast slot (so cuts frame the real body, not a guess). */
const actorHeights = new Map<number, number>();
/** Largest body extent (long creatures need wider framing than their height). */
const actorSizes = new Map<number, number>();
const SEAL_GEOMS = new Set(["TorusGeometry", "OctahedronGeometry", "RingGeometry"]);
import type { Emote } from "@/lib/toon-script";
import { toonEmotes, toonHeads } from "@/lib/toon-anchors";

/** Vector comic icons (no emoji fonts) so every browser and export draws the same thing. */
function drawEmote(x: CanvasRenderingContext2D, e: Emote) {
  x.lineJoin = x.lineCap = "round"; x.lineWidth = 5; x.strokeStyle = "#111";
  const txt = (s: string, col: string, size = 64) => { x.font = `900 ${size}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = col; x.fillText(s, 64, 62); x.strokeText(s, 64, 62); };
  x.beginPath();
  switch (e) {
    case "love": x.moveTo(64, 88); x.bezierCurveTo(20, 60, 34, 22, 64, 44); x.bezierCurveTo(94, 22, 108, 60, 64, 88); x.fillStyle = "#ff3b6b"; x.fill(); x.stroke(); break;
    case "happy": for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 32, a = -Math.PI / 2 + (i * Math.PI) / 5; x.lineTo(64 + Math.cos(a) * r, 58 + Math.sin(a) * r); } x.closePath(); x.fillStyle = "#ffd23f"; x.fill(); x.stroke(); break;
    case "afraid": x.moveTo(64, 24); x.bezierCurveTo(90, 60, 88, 90, 64, 90); x.bezierCurveTo(40, 90, 38, 60, 64, 24); x.fillStyle = "#6cc8ff"; x.fill(); x.stroke(); break;
    case "terrified": x.moveTo(72, 18); x.lineTo(42, 64); x.lineTo(62, 64); x.lineTo(52, 98); x.lineTo(86, 50); x.lineTo(66, 50); x.closePath(); x.fillStyle = "#ffe14d"; x.fill(); x.stroke(); break;
    case "lonely": x.arc(48, 62, 18, Math.PI * 0.5, Math.PI * 1.5); x.arc(66, 46, 22, Math.PI, 0); x.arc(84, 62, 16, Math.PI * 1.5, Math.PI * 0.5); x.closePath(); x.fillStyle = "#9aa5b8"; x.fill(); x.stroke();
      x.beginPath(); for (const dx of [50, 66, 82]) { x.moveTo(dx, 84); x.lineTo(dx - 4, 96); } x.strokeStyle = "#3b82f6"; x.stroke(); break;
    case "sad": x.arc(64, 58, 28, 0, Math.PI * 2); x.fillStyle = "#ffd23f"; x.fill(); x.stroke(); x.beginPath(); x.arc(64, 78, 12, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
      x.fillStyle = "#111"; x.fillRect(51, 48, 5, 7); x.fillRect(72, 48, 5, 7); x.beginPath(); x.ellipse(52, 66, 4, 7, 0, 0, Math.PI * 2); x.fillStyle = "#6cc8ff"; x.fill(); break;
    case "angry": x.strokeStyle = "#e11d2e"; x.lineWidth = 9; for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) { x.moveTo(64 + a * 8, 58 + b * 26); x.quadraticCurveTo(64 + a * 8, 58 + b * 8, 64 + a * 26, 58 + b * 8); } x.stroke(); break;
    case "surprised": txt("!", "#ff6a00", 80); break;
    case "sleepy": txt("Zz", "#7c8cff", 52); break;
  }
}

/** Comic emote bubble drawn once to a canvas texture so it bakes into exports. */
function EmoteIcon({ emote, timeRef, slot, scene }: { emote: Emote; timeRef: MutableRefObject<number>; slot: number; scene: number }) {
  const sp = useRef<Sprite>(null);
  const wp = useMemo(() => new Vector3(), []), tp = useMemo(() => new Vector3(), []), ws = useMemo(() => new Vector3(), []);
  useEffect(() => () => { toonEmotes.delete(slot); }, [slot]);
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff"; x.strokeStyle = "#111"; x.lineWidth = 6;
    x.beginPath(); x.arc(64, 58, 50, 0, Math.PI * 2); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(50, 104); x.lineTo(64, 124); x.lineTo(76, 104); x.fill();
    drawEmote(x, emote);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  }, [emote]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ camera }) => {
    const o = sp.current, t = timeRef.current;
    if (!o) return;
    // Keep the bubble readable on far shots (wide/crane): grow with camera distance.
    const dist = o.parent ? camera.position.distanceTo(o.parent.getWorldPosition(o.position.clone().set(0, 0, 0))) : 30;
    let s = 0.34 * Math.min(2.6, Math.max(1, dist / 32)), y = 0.95;
    if (emote === "love" || emote === "happy") s *= 1 + Math.abs(Math.sin(t * 4)) * 0.18;
    if (emote === "terrified" || emote === "afraid") o.position.x = 0.75 + Math.sin(t * 40) * 0.03;
    if (emote === "sad" || emote === "lonely" || emote === "sleepy") y += Math.sin(t * 1.2) * 0.06;
    if (emote === "surprised" || emote === "angry") s *= 1 + Math.max(0, Math.sin(t * 6)) * 0.25;
    o.position.y = y; o.scale.setScalar(s);
    // Publish the icon's screen circle so speech bubbles are placed around it.
    o.updateWorldMatrix(true, false);
    o.getWorldPosition(wp); o.getWorldScale(ws);
    tp.copy(wp); tp.y += ws.y * 0.55; tp.project(camera); wp.project(camera);
    if (wp.z < 1) toonEmotes.set(slot, { x: (wp.x + 1) / 2, y: (1 - wp.y) / 2, r: Math.abs(wp.y - tp.y) / 2, scene });
    else toonEmotes.delete(slot);
  });
  return <sprite ref={sp} position={[0.75, 0.95, 0]}><spriteMaterial map={tex} depthTest={false} transparent /></sprite>;
}
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { forgeBuildQuery } from "@/lib/forge";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { parcelRects } from "@/lib/forge-parcels";
import { FORGE_SPAN } from "@/lib/voxel-populate";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { sceneAt, actorPositionAt, activeCut, type ToonActor, type ToonEpisode, type ToonLine, type ToonScene, type Shot } from "@/lib/toon-script";

/** One Guardian actor; pose is a procedural cartoon loop on top of its real on-chain body. */
function Actor({ actor, slot, scene, timeRef, progressRef, durRef }: { actor: ToonActor; slot: number; scene: number; timeRef: MutableRefObject<number>; progressRef: MutableRefObject<number>; durRef: MutableRefObject<number> }) {
  const g = useRef<Group>(null);
  const dna = useQuery({ ...guardianDnaQuery(actor.height), staleTime: Infinity });
  const head = useMemo(() => new Vector3(), []);
  const unitH = useRef(0), unitS = useRef(0), frames = useRef(0);
  useEffect(() => () => { toonHeads.delete(slot); actorHeights.delete(slot); actorSizes.delete(slot); }, [slot]);
  useFrame(({ camera }) => {
    const t = timeRef.current, o = g.current;
    if (!o) return;
    const pos = actorPositionAt(actor, progressRef.current, durRef.current);
    const dx = actor.to ? actor.to.x - actor.x : 0, dz = actor.to ? actor.to.z - actor.z : 0;
    let y = 0, x = pos.x, rz = 0, ry = actor.to && (dx || dz) ? Math.atan2(dx, dz) : actor.x > 0 ? -Math.PI / 2 : Math.PI / 2, s = 1;
    if (actor.pose === "idle") y = Math.sin(t * 2) * 0.15;
    if (pos.moving && actor.pose !== "jump") y = Math.abs(Math.sin(t * 6)) * 0.5;
    else if (actor.pose === "walk") { x = actor.x + Math.sin(t * 0.6) * 4; y = Math.abs(Math.sin(t * 6)) * 0.5; ry = Math.cos(t * 0.6) > 0 ? Math.PI / 2 : -Math.PI / 2; }
    if (actor.pose === "talk") { y = Math.abs(Math.sin(t * 8)) * 0.35; s = 1 + Math.sin(t * 8) * 0.03; }
    if (actor.pose === "jump") y = Math.max(0, Math.sin(t * 3.5)) * 4;
    if (actor.pose === "combat") { rz = Math.sin(t * 10) * 0.08; s = 1.08; }
    let rx = 0, sy = 1;
    switch (actor.emote) {
      case "love": rz += Math.sin(t * 2) * 0.1; y += Math.sin(t * 3) * 0.3 + 0.3; break;
      case "happy": y += Math.abs(Math.sin(t * 9)) * 0.9; break;
      case "afraid": x += Math.sin(t * 35) * 0.12; sy = 0.9; rx = -0.12; break;
      case "terrified": x += Math.sin(t * 60) * 0.3; rz += Math.sin(t * 47) * 0.1; rx = -0.3; break;
      case "lonely": rx = 0.25; y = Math.sin(t * 0.8) * 0.08; break;
      case "sad": rx = 0.35; sy = 0.88; y = 0; break;
      case "angry": rz += Math.sin(t * 25) * 0.05; s *= 1.1; break;
      case "surprised": y += Math.max(0, Math.sin(t * 4)) * 1.2; sy = 1.08; break;
      case "sleepy": rz += Math.sin(t * 0.9) * 0.15; rx = 0.2; break;
    }
    o.position.set(x, y, pos.z);
    o.rotation.set(rx, ry, rz);
    if (o.children.length && frames.current++ % 30 === 0) {
      o.scale.set(1, 1, 1); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.updateMatrixWorld(true);
      // Body voxels only — halos, seals and gems float above the head and would skew framing.
      const b = new Box3(), tmp = new Box3();
      o.traverse((m) => { const g = (m as { geometry?: { type?: string } }).geometry; if (!g || SEAL_GEOMS.has(g.type ?? "")) return;
        // InstancedMesh caches its bounds before the voxels are written; refresh them.
        (m as { computeBoundingBox?: () => void }).computeBoundingBox?.();
        b.union(tmp.setFromObject(m)); });
      if (!b.isEmpty()) { unitH.current = Math.max(0.2, b.max.y); unitS.current = Math.max(b.max.y, b.max.x - b.min.x, b.max.z - b.min.z); }
    }
    o.scale.set(10 * s, 10 * s * sy, 10 * s);
    const bodyH = (unitH.current || 1.2) * 10;
    actorHeights.set(slot, bodyH); actorSizes.set(slot, Math.max(bodyH, (unitS.current || 0) * 10 * s));
    // Publish the head's screen position for the speech-bubble overlay.
    if (dna.data) {
      head.set(x, y + bodyH * s * sy * 0.92, pos.z).project(camera);
      if (head.z < 1) toonHeads.set(slot, { x: (head.x + 1) / 2, y: (1 - head.y) / 2, scene });
      else toonHeads.delete(slot);
    }
  });
  const d = dna.data;
  if (!d) return null;
  return (
    <group ref={g}>
      <GuardianBody species={d.species} rarity={d.rarity} body={d.body} accent={d.accent} height={actor.height} inscribed />
      {actor.emote && <EmoteIcon emote={actor.emote} timeRef={timeRef} slot={slot} scene={scene} />}
    </group>
  );
}

function Land({ block }: { block: number }) {
  const sizes = useQuery({ ...blockSizeMapQuery(block), staleTime: Infinity });
  const build = useQuery(forgeBuildQuery(block));
  const parcels = useMemo(() => parcelRects(sizes.data?.classes, FORGE_SPAN).filter((r) => r.x1 - r.x0 >= 2).slice(0, 300), [sizes.data]);
  return (
    <group>
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[FORGE_SPAN, 1.2, FORGE_SPAN]} />
        <meshStandardMaterial color="#d9b77a" roughness={1} />
      </mesh>
      {parcels.map((r) => {
        const w = r.x1 - r.x0, dd = r.z1 - r.z0;
        return (
          <mesh key={r.index} position={[r.x0 + w / 2 - FORGE_SPAN / 2, 0.1, r.z0 + dd / 2 - FORGE_SPAN / 2]}>
            <boxGeometry args={[w * 0.92, 0.25, dd * 0.92]} />
            <meshStandardMaterial color={r.size >= 2 ? "#f7931a" : "#c9a466"} roughness={0.8} />
          </mesh>
        );
      })}
      {build.data?.data && <ForgeBuild3D height={block} position={[0, 0, 0]} cell={40} />}
    </group>
  );
}

function shotPose(shot: Shot, p: number): [number, number, number, number, number, number] {
  let x = 0, y = 0, z = 0;
  if (shot === "wide") { const a = 0.6 + p * 0.5; x = Math.cos(a) * 70; z = Math.sin(a) * 70; y = 38; }
  if (shot === "orbit") { const a = p * Math.PI * 1.2; x = Math.cos(a) * 34; z = Math.sin(a) * 34; y = 14; }
  if (shot === "dolly") { x = 6; z = 60 - p * 32; y = 6 + (1 - p) * 6; }
  if (shot === "dutch") { x = 22; z = 22; y = 5; }
  if (shot === "crane") { x = 10; z = 20; y = 80 - p * 66; }
  return [x, y, z, 0, 4, 0];
}

/** Camera framing for a dialogue cut, built from the speaker's (and listener's) live positions. */
function cutPose(scene: ToonScene, line: ToonLine, local: number): [number, number, number, number, number, number] {
  const at = (i: number) => { const a = scene.cast[i]; return a ? actorPositionAt(a, local, scene.duration) : { x: 0, z: 0 }; };
  const sp = at(line.speaker), oi = scene.cast.findIndex((_, i) => i !== line.speaker), ot = oi >= 0 ? at(oi) : { x: sp.x - 10, z: sp.z + 10 };
  let dx = sp.x - ot.x, dz = sp.z - ot.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  const px = -dz, pz = dx; // perpendicular (camera side)
  // Frame from measured body heights; fov 40 → distance ≈ 1.4 × visible height.
  const hs = actorHeights.get(line.speaker) ?? 12, ho = oi >= 0 ? actorHeights.get(oi) ?? hs : hs;
  // (dx,dz) points from listener to speaker; close-ups sit in front of the speaker, angled toward the listener.
  const ss = actorSizes.get(line.speaker) ?? hs, so = oi >= 0 ? actorSizes.get(oi) ?? ss : ss;
  if (line.cam === "close") { const d = ss * 1.25; return [sp.x - dx * d * 0.35 + px * d, hs * 0.75, sp.z - dz * d * 0.35 + pz * d, sp.x, hs * 0.6, sp.z]; }
  if (line.cam === "ots") { const d = Math.max(so, ss) * 0.8; return [ot.x - dx * d + px * d * 0.6, ho * 1.1, ot.z - dz * d + pz * d * 0.6, sp.x, hs * 0.55, sp.z]; }
  const h = Math.max(hs, ho), mx = (sp.x + ot.x) / 2, mz = (sp.z + ot.z) / 2, span = Math.max(h * 2.2, Math.max(ss, so) * 1.6, L * 1.4);
  return [mx + px * span, h * 0.75, mz + pz * span, mx, h * 0.5, mz];
}

function Director({ scene, local }: { scene: ToonScene; local: number }) {
  const { camera } = useThree();
  const cur = useRef<number[] | null>(null), last = useRef(local);
  useFrame(() => {
    const p = Math.min(1, local / scene.duration), line = activeCut(scene, local);
    const target = line ? cutPose(scene, line, local) : shotPose(scene.shot, p);
    const jumped = Math.abs(local - last.current) > 0.5; last.current = local;
    if (!cur.current || !scene.cutBlend || jumped) cur.current = [...target];
    else for (let i = 0; i < 6; i++) cur.current[i]! += (target[i]! - cur.current[i]!) * 0.12;
    const c = cur.current;
    camera.position.set(c[0]!, c[1]!, c[2]!);
    camera.up.set(scene.shot === "dutch" && !line ? Math.sin(0.25) : 0, 1, 0);
    camera.lookAt(c[3]!, c[4]!, c[5]!);
  });
  return null;
}

/** Driven entirely by `time` so playback, scrubbing and recording all match. */
export default function ToonStage3D({ episode, time }: { episode: ToonEpisode; time: number }) {
  const timeRef = useRef(time);
  timeRef.current = time;
  const { index, local } = sceneAt(episode, time);
  const progressRef = useRef(0);
  progressRef.current = local;
  const durRef = useRef(1);
  durRef.current = episode.scenes[index]?.duration ?? 1;
  const scene = episode.scenes[index];
  if (!scene) return null;
  return (
    <SafeCanvas dpr={[1, 1.5]} camera={{ fov: 40, position: [40, 30, 40] }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={["#7fc8e8"]} />
      <fog attach="fog" args={["#7fc8e8", 90, 220]} />
      <hemisphereLight args={["#ffffff", "#d9b77a", 0.9]} />
      <directionalLight position={[40, 80, 30]} intensity={1.8} />
      <Land key={scene.block} block={scene.block} />
      {scene.cast.map((a, i) => <Actor key={`${index}-${i}-${a.height}`} actor={a} slot={i} scene={index} timeRef={timeRef} progressRef={progressRef} durRef={durRef} />)}
      <Director key={index} scene={scene} local={local} />
    </SafeCanvas>
  );
}
