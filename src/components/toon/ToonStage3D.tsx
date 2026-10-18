import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import { CanvasTexture, SRGBColorSpace, type Group, type Sprite } from "three";
import { EMOTES, type Emote } from "@/lib/toon-script";

/** Comic emote bubble drawn once to a canvas texture so it bakes into exports. */
function EmoteIcon({ emote, timeRef }: { emote: Emote; timeRef: MutableRefObject<number> }) {
  const sp = useRef<Sprite>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff"; x.strokeStyle = "#111"; x.lineWidth = 6;
    x.beginPath(); x.arc(64, 58, 50, 0, Math.PI * 2); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(50, 104); x.lineTo(64, 124); x.lineTo(76, 104); x.fill();
    x.font = "60px serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(EMOTES.find((e) => e.v === emote)?.icon ?? "", 64, 62);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  }, [emote]);
  useFrame(() => {
    const o = sp.current, t = timeRef.current;
    if (!o) return;
    let s = 0.45, y = 1.5;
    if (emote === "love" || emote === "happy") s *= 1 + Math.abs(Math.sin(t * 4)) * 0.18;
    if (emote === "terrified" || emote === "afraid") o.position.x = Math.sin(t * 40) * 0.03;
    if (emote === "sad" || emote === "lonely" || emote === "sleepy") y += Math.sin(t * 1.2) * 0.06;
    if (emote === "surprised" || emote === "angry") s *= 1 + Math.max(0, Math.sin(t * 6)) * 0.25;
    o.position.y = y; o.scale.setScalar(s);
  });
  return <sprite ref={sp} position={[0, 1.5, 0]}><spriteMaterial map={tex} depthTest={false} transparent /></sprite>;
}
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { forgeBuildQuery } from "@/lib/forge";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { parcelRects } from "@/lib/forge-parcels";
import { FORGE_SPAN } from "@/lib/voxel-populate";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { sceneAt, actorPositionAt, type ToonActor, type ToonEpisode, type Shot } from "@/lib/toon-script";

/** One Guardian actor; pose is a procedural cartoon loop on top of its real on-chain body. */
function Actor({ actor, timeRef, progressRef, durRef }: { actor: ToonActor; timeRef: MutableRefObject<number>; progressRef: MutableRefObject<number>; durRef: MutableRefObject<number> }) {
  const g = useRef<Group>(null);
  const dna = useQuery({ ...guardianDnaQuery(actor.height), staleTime: Infinity });
  useFrame(() => {
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
    o.scale.set(10 * s, 10 * s * sy, 10 * s);
  });
  const d = dna.data;
  if (!d) return null;
  return (
    <group ref={g}>
      <GuardianBody species={d.species} rarity={d.rarity} body={d.body} accent={d.accent} height={actor.height} inscribed />
      {actor.emote && <EmoteIcon emote={actor.emote} timeRef={timeRef} />}
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

function Director({ shot, local, dur }: { shot: Shot; local: number; dur: number }) {
  const { camera } = useThree();
  useFrame(() => {
    const p = Math.min(1, local / dur);
    let x = 0, y = 0, z = 0;
    if (shot === "wide") { const a = 0.6 + p * 0.5; x = Math.cos(a) * 70; z = Math.sin(a) * 70; y = 38; }
    if (shot === "orbit") { const a = p * Math.PI * 1.2; x = Math.cos(a) * 34; z = Math.sin(a) * 34; y = 14; }
    if (shot === "dolly") { x = 6; z = 60 - p * 32; y = 6 + (1 - p) * 6; }
    if (shot === "dutch") { x = 22; z = 22; y = 5; }
    if (shot === "crane") { x = 10; z = 20; y = 80 - p * 66; }
    camera.position.set(x, y, z);
    camera.up.set(shot === "dutch" ? Math.sin(0.25) : 0, 1, 0);
    camera.lookAt(0, 4, 0);
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
      {scene.cast.map((a, i) => <Actor key={`${index}-${i}-${a.height}`} actor={a} timeRef={timeRef} progressRef={progressRef} durRef={durRef} />)}
      <Director shot={scene.shot} local={local} dur={scene.duration} />
    </SafeCanvas>
  );
}
