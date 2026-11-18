/** 3D view of the live game world, drawn from the visitor's own map and prop files. */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { events as r3fEvents, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import type { L2World } from "@/lib/l2/l2-session";
import type { PropModel, WorldLibrary, WorldTile } from "@/lib/l2/l2-world-loader";
import { heightAt, type StaticActor } from "@/lib/l2/l2-world";

/** Props closer than this (game units) to the character are drawn. */
export const PROP_RADIUS = 6000;
const MAX_PROPS = 400;

// Page-size CSS zoom skews R3F's default picking; measure the visual rect instead.
const zoomSafeEvents = (store: Parameters<typeof r3fEvents>[0]) => ({
  ...r3fEvents(store),
  compute(e: { clientX: number; clientY: number }, state: RootState) {
    const r = state.gl.domElement.getBoundingClientRect();
    state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.raycaster.setFromCamera(state.pointer, state.camera);
  },
});

type O = { x: number; y: number; z: number };
/** Game (X, Y, Z-up) → scene (X, Z, Y), relative to an origin; matches the StaticMesh decoder's axis swap. */
const toScene = (p: O, o: O): [number, number, number] => [p.x - o.x, p.z - o.z, p.y - o.y];
const SWAP = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1);

function Terrain({ tile, origin, onPick }: { tile: WorldTile; origin: O; onPick: (p: O) => void }) {
  const t = tile.terrain!;
  const geo = useMemo(() => {
    const step = Math.max(1, Math.ceil(Math.max(t.width, t.height) / 256));
    const w = Math.floor((t.width - 1) / step) + 1, h = Math.floor((t.height - 1) / step) + 1;
    const pos = new Float32Array(w * h * 3), col = new Float32Array(w * h * 3);
    let lo = Infinity, hi = -Infinity;
    for (const v of t.heights) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const low = new THREE.Color("#4f6b3a"), high = new THREE.Color("#b9ad8f"), c = new THREE.Color();
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const z = t.heights[j * step * t.width + i * step]!, k = (j * w + i) * 3;
      pos[k] = t.originX + i * step * t.stepX - origin.x; pos[k + 1] = z - origin.z; pos[k + 2] = t.originY + j * step * t.stepY - origin.y;
      c.copy(low).lerp(high, hi > lo ? (z - lo) / (hi - lo) : 0); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
    const idx: number[] = [];
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i; idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }, [t, origin]);
  useEffect(() => () => geo.dispose(), [geo]);
  const click = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); onPick({ x: e.point.x + origin.x, y: e.point.z + origin.y, z: e.point.y + origin.z }); };
  return <mesh geometry={geo} onClick={click} receiveShadow><meshStandardMaterial vertexColors roughness={0.95} side={THREE.DoubleSide} /></mesh>;
}

function PropGroup({ model, actors, origin }: { model: PropModel; actors: StaticActor[]; origin: O }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(), m = model.mesh;
    g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3)); g.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
    if (m.uvs) g.setAttribute("uv", new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1)); m.groups.forEach((gr, i) => g.addGroup(gr.start, gr.count, i));
    return g;
  }, [model]);
  const mats = useMemo(() => Array.from({ length: Math.max(1, model.mesh.groups.length) }, (_, i) => {
    const t = model.textures[i];
    if (!t || !model.mesh.uvs) return new THREE.MeshStandardMaterial({ color: "#8f8a80", roughness: 0.85 });
    const tex = new THREE.DataTexture(t.rgba, t.width, t.height, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, alphaTest: t.hasAlpha ? 0.5 : 0, side: THREE.DoubleSide });
  }), [model]);
  useEffect(() => () => { geo.dispose(); mats.forEach((m) => { m.map?.dispose(); m.dispose(); }); }, [geo, mats]);
  useEffect(() => {
    const im = ref.current; if (!im) return;
    const m = new THREE.Matrix4(), rot = new THREE.Matrix4(), e = new THREE.Euler();
    actors.forEach((a, i) => {
      // Build the placement in game space (yaw about Z, pitch about Y, roll about X), then swap to scene axes.
      e.set(a.roll, -a.pitch, a.yaw, "ZYX"); rot.makeRotationFromEuler(e);
      m.makeTranslation(a.pos.x - origin.x, a.pos.y - origin.y, a.pos.z - origin.z).multiply(rot).multiply(new THREE.Matrix4().makeScale(a.scale.x, a.scale.y, a.scale.z));
      im.setMatrixAt(i, SWAP.clone().multiply(m).multiply(SWAP));
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  }, [actors, origin]);
  return <instancedMesh ref={ref} args={[geo, model.mesh.groups.length ? mats : mats[0]!, actors.length]} castShadow receiveShadow frustumCulled={false} />;
}

function Props({ tile, library, origin, center, onStatus }: { tile: WorldTile; library: WorldLibrary; origin: O; center: O; onStatus: (s: string) => void }) {
  const near = useMemo(() => tile.actors
    .map((a) => ({ a, d: Math.hypot(a.pos.x - center.x, a.pos.y - center.y) })).filter((x) => x.d < PROP_RADIUS)
    .sort((p, q) => p.d - q.d).slice(0, MAX_PROPS).map((x) => x.a),
  // Re-pick nearby props only when the character has moved a fair way.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [tile, Math.round(center.x / 1500), Math.round(center.y / 1500)]);
  const [models, setModels] = useState<Map<number, PropModel>>(new Map());
  useEffect(() => {
    let live = true;
    const refs = [...new Set(near.map((a) => a.meshRef))];
    void (async () => {
      const out = new Map<number, PropModel>(); const fails = new Map<string, number>();
      for (const r of refs) {
        const m = await library.meshFor(tile.pkg, r);
        if (!live) return;
        if (typeof m === "string") fails.set(m, (fails.get(m) ?? 0) + 1); else out.set(r, m);
        if (out.size % 8 === 0) setModels(new Map(out));
      }
      setModels(out);
      const top = [...fails.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${n}× ${k}`);
      onStatus(`${out.size.toLocaleString("en-US")} of ${refs.length.toLocaleString("en-US")} nearby prop models drawn${top.length ? ` · not drawn: ${top.join("; ")}` : ""}`);
    })();
    return () => { live = false; };
  }, [near, library, tile, onStatus]);
  const byRef = useMemo(() => { const g = new Map<number, StaticActor[]>(); for (const a of near) { if (!models.has(a.meshRef)) continue; g.set(a.meshRef, [...(g.get(a.meshRef) ?? []), a]); } return g; }, [near, models]);
  return <>{[...byRef].map(([r, list]) => <PropGroup key={`${r}:${list.length}`} model={models.get(r)!} actors={list} origin={origin} />)}</>;
}

function Follow({ target, controls }: { target: [number, number, number]; controls: React.RefObject<OrbitImpl | null> }) {
  const goal = useMemo(() => new THREE.Vector3(...target), [target]);
  const ready = useRef(false);
  useFrame(({ camera }, dt) => {
    const c = controls.current; if (!c) return;
    if (!ready.current) { ready.current = true; c.target.copy(goal); c.update(); return; }
    const step = c.target.clone().lerp(goal, 1 - Math.exp(-6 * Math.min(dt, 0.05))).sub(c.target);
    c.target.add(step); camera.position.add(step); c.update();
  });
  return null;
}

const KIND_COLOR = { npc: "#2bd4e6", player: "#f7931a", item: "#d7d2c4" } as const;
export default function L2WorldScene({ world, tile, library, onMove, onStatus }: { world: L2World; tile: WorldTile; library: WorldLibrary; onMove: (p: O) => void; onStatus: (s: string) => void }) {
  const me = world.self;
  // Origin fixed per tile so float precision stays good and geometry isn't rebuilt as you walk.
  const origin = useMemo(() => ({ x: me.x, y: me.y, z: me.z }), [tile]); // eslint-disable-line react-hooks/exhaustive-deps
  const ground = (p: O) => (tile.terrain ? heightAt(tile.terrain, p.x, p.y) : null);
  const meAt = toScene({ ...me, z: Math.max(me.z, ground(me) ?? -Infinity) }, origin);
  const controls = useRef<OrbitImpl | null>(null);
  useEffect(() => { document.querySelector("[data-l2-world]")?.setAttribute("data-scene-ready", "1"); }, []);
  return (
    <SafeCanvas events={zoomSafeEvents} shadows camera={{ position: [meAt[0] - 600, meAt[1] + 700, meAt[2] + 900], fov: 50, near: 5, far: 60000 }}>
      <color attach="background" args={["#9fb7c9"]} />
      <fog attach="fog" args={["#9fb7c9", 4000, 22000]} />
      <hemisphereLight args={["#dbeeff", "#3a3320", 0.9]} />
      <directionalLight position={[3000, 6000, 2000]} intensity={1.8} />
      {tile.terrain ? <Terrain tile={tile} origin={origin} onPick={onMove} /> : null}
      <Props tile={tile} library={library} origin={origin} center={me} onStatus={onStatus} />
      {world.objects.map((o) => {
        const p = toScene({ ...o, z: Math.max(o.z, ground(o) ?? -Infinity) }, origin);
        return <mesh key={o.objectId} position={[p[0], p[1] + 25, p[2]]}><capsuleGeometry args={[10, 30, 4, 8]} /><meshStandardMaterial color={KIND_COLOR[o.kind]} /></mesh>;
      })}
      <mesh position={[meAt[0], meAt[1] + 30, meAt[2]]} castShadow><capsuleGeometry args={[12, 36, 4, 10]} /><meshStandardMaterial color="#f7931a" emissive="#7a3a00" /></mesh>
      <mesh position={[meAt[0], meAt[1] + 2, meAt[2]]} rotation-x={-Math.PI / 2}><ringGeometry args={[22, 30, 32]} /><meshBasicMaterial color="#f7931a" /></mesh>
      <OrbitControls ref={controls} maxPolarAngle={Math.PI * 0.48} minDistance={150} maxDistance={8000} />
      <Follow target={meAt} controls={controls} />
    </SafeCanvas>
  );
}
