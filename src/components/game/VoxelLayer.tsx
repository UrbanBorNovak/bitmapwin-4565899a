/**
 * VOXEL LAYER — stepped block terrain around the player plus the shared
 * public block world. Left click breaks, right click places (block mode, F9).
 * Edits save to the backend and broadcast live to everyone in the Oasis.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  VOXEL, VOXEL_DEPTH, VOXEL_RADIUS, VOXEL_REACH, applyEdit, blockAt, blockColor, edits,
  columnSurface, onVoxelMode, onVoxels, terrainTop, toCell, voxelMode, vkey,
} from "@/lib/voxel-world";
import { editVoxelFn, voxelsNearFn } from "@/lib/voxel-world.functions";
import { playSfx } from "@/lib/world-audio";
import type { PlayerState } from "@/lib/player-state";

const MAX = 9000;
const noRaycast = () => {};

type Hit = { cell: [number, number, number]; normal: [number, number, number] };

/** Amanatides–Woo grid walk from an origin along a direction. */
function castVoxel(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): Hit | null {
  let x = toCell(o.x), y = toCell(o.y), z = toCell(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const next = (c: number, s: number, p: number) => ((s > 0 ? c + 1 : c) * VOXEL - p);
  let tMaxX = d.x ? next(x, sx, o.x) / d.x : Infinity;
  let tMaxY = d.y ? next(y, sy, o.y) / d.y : Infinity;
  let tMaxZ = d.z ? next(z, sz, o.z) / d.z : Infinity;
  const dX = d.x ? Math.abs(VOXEL / d.x) : Infinity, dY = d.y ? Math.abs(VOXEL / d.y) : Infinity, dZ = d.z ? Math.abs(VOXEL / d.z) : Infinity;
  let n: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 128; i++) {
    if (blockAt(x, y, z)) return { cell: [x, y, z], normal: n };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { if (tMaxX > maxDist) break; x += sx; tMaxX += dX; n = [-sx, 0, 0]; }
    else if (tMaxY < tMaxZ) { if (tMaxY > maxDist) break; y += sy; tMaxY += dY; n = [0, -sy, 0]; }
    else { if (tMaxZ > maxDist) break; z += sz; tMaxZ += dZ; n = [0, 0, -sz]; }
  }
  return null;
}

export function VoxelLayer({ pose, firstPerson, armed }: { pose: React.RefObject<PlayerState>; firstPerson: boolean; armed: boolean }) {
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const glowMesh = useRef<THREE.InstancedMesh>(null);
  const outline = useRef<THREE.LineSegments>(null);
  const center = useRef<[number, number] | null>(null);
  const loaded = useRef<[number, number] | null>(null);
  const [mode, setMode] = useState(voxelMode.on);
  const hit = useRef<Hit | null>(null);
  const ndc = useRef(new THREE.Vector2());
  const dirty = useRef(true);
  const edit = useMemo(() => editVoxelFn, []);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => onVoxelMode(() => setMode(voxelMode.on)), []);
  useEffect(() => onVoxels(() => (dirty.current = true)), []);

  // Live edits from everyone else.
  useEffect(() => {
    const ch = supabase.channel("oasis-voxels", { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "edit" }, ({ payload }) => {
      const p = payload as { x: number; y: number; z: number; kind: string };
      if ([p.x, p.y, p.z].every(Number.isInteger) && typeof p.kind === "string" && p.kind.length < 17) applyEdit(p.x, p.y, p.z, p.kind);
    }).subscribe();
    channel.current = ch;
    return () => void supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      ndc.current.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  // Break / place.
  useEffect(() => {
    if (!mode || armed) return;
    const commit = async (x: number, y: number, z: number, kind: string) => {
      const before = edits.get(vkey(x, y, z)) ?? null;
      applyEdit(x, y, z, kind);
      const r = await edit({ data: { x, y, z, kind } }).catch(() => ({ ok: false as const, error: "SIGN IN TO BUILD" }));
      if (!r.ok) {
        applyEdit(x, y, z, before);
        toast.error(r.error);
        return;
      }
      void channel.current?.send({ type: "broadcast", event: "edit", payload: { x, y, z, kind } });
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.tagName !== "CANVAS") return;
      const h = hit.current;
      if (!h) return;
      e.stopImmediatePropagation();
      const [x, y, z] = h.cell;
      if (e.button === 0) {
        const cur = edits.get(vkey(x, y, z));
        if (!cur || cur === "air") return; // natural ground is not breakable
        playSfx("hit");
        void commit(x, y, z, "air");
      } else if (e.button === 2) {
        const [nx, ny, nz] = h.normal;
        const px = x + nx, py = y + ny, pz = z + nz;
        // never entomb yourself
        const me = pose.current;
        if (me && toCell(me.x) === px && toCell(me.z) === pz) {
          const feet = Math.round((columnSurface(me.x, me.z) ?? 0) / VOXEL);
          if (py >= feet && py <= feet + 1) return;
        }
        playSfx("hit");
        void commit(px, py, pz, voxelMode.block);
      }
    };
    const ctx = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("contextmenu", ctx);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("contextmenu", ctx);
    };
  }, [mode, armed, edit, pose]);

  const color = useMemo(() => new THREE.Color(), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);

  useFrame(() => {
    const me = pose.current;
    if (!me) return;
    const cx = toCell(me.x), cz = toCell(me.z);
    // Load shared edits when the player wanders far from the last fetch.
    const l = loaded.current;
    if (!l || Math.abs(l[0] - cx) > 24 || Math.abs(l[1] - cz) > 24) {
      loaded.current = [cx, cz];
      void voxelsNearFn({ data: { x: cx, z: cz, r: 48 } }).then((r) => {
        for (const b of r.blocks) if (edits.get(vkey(b.x, b.y, b.z)) !== b.kind) applyEdit(b.x, b.y, b.z, b.kind);
      }).catch(() => {});
    }
    const c = center.current;
    if (dirty.current || !c || Math.abs(c[0] - cx) > 3 || Math.abs(c[1] - cz) > 3) {
      center.current = [cx, cz];
      dirty.current = false;
      const im = mesh.current, gm = glowMesh.current;
      if (!im || !gm) return;
      let n = 0, g = 0;
      const put = (x: number, y: number, z: number, kind: string) => {
        const target = kind === "glow" ? gm : im;
        const i = kind === "glow" ? g++ : n++;
        if (i >= (kind === "glow" ? 512 : MAX)) return;
        m4.makeTranslation((x + 0.5) * VOXEL, (y + 0.5) * VOXEL, (z + 0.5) * VOXEL);
        target.setMatrixAt(i, m4);
        const b = blockColor(kind);
        const shade = 0.9 + ((x * 7 + z * 13 + y * 3) & 7) / 70;
        color.set(b.top).multiplyScalar(shade);
        target.setColorAt(i, color);
      };
      // Only player-placed blocks render; the natural world stays untouched.
      const R = VOXEL_RADIUS * 3;
      for (const [k, kind] of edits) {
        if (kind === "air") continue;
        const [x, y, z] = k.split(",").map(Number) as [number, number, number];
        if (Math.abs(x - cx) > R || Math.abs(z - cz) > R) continue;
        put(x, y, z, kind);
      }
      im.count = Math.min(n, MAX);
      gm.count = Math.min(g, 512);
      im.instanceMatrix.needsUpdate = true;
      gm.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
    }

    // Target the block under the crosshair (first person) or the mouse.
    if (mode && !armed) {
      ray.setFromCamera(firstPerson ? new THREE.Vector2(0, 0) : ndc.current, camera);
      const reach = VOXEL * VOXEL_REACH + camera.position.distanceTo(new THREE.Vector3(me.x, camera.position.y, me.z));
      hit.current = castVoxel(ray.ray.origin, ray.ray.direction, reach);
    } else hit.current = null;
    const o = outline.current;
    if (o) {
      o.visible = Boolean(hit.current);
      if (hit.current) {
        const [x, y, z] = hit.current.cell;
        o.position.set((x + 0.5) * VOXEL, (y + 0.5) * VOXEL, (z + 0.5) * VOXEL);
      }
    }
  });

  const box = useMemo(() => new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(VOXEL * 1.02, VOXEL * 1.02, VOXEL * 1.02)), []);
  return (
    <>
      <instancedMesh ref={mesh} args={[box, undefined, MAX]} raycast={noRaycast} frustumCulled={false} receiveShadow castShadow>
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={glowMesh} args={[box, undefined, 512]} raycast={noRaycast} frustumCulled={false}>
        <meshStandardMaterial emissive="#ffc35a" emissiveIntensity={1.4} toneMapped={false} />
      </instancedMesh>
      <lineSegments ref={outline} geometry={edgeGeo} raycast={noRaycast} visible={false}>
        <lineBasicMaterial color="#111111" />
      </lineSegments>
    </>
  );
}
