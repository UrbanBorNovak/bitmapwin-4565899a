/**
 * Three.js master-renderer preview. Reads the frozen on-chain blueprint (no change to
 * shapes or colours) and only upgrades projection: one InstancedMesh, studio lights,
 * soft contact shadow, native orbit/pinch controls. Sizes by offsetWidth (CSS-zoom safe).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GuardianDna } from "@/lib/bitmon";
import { animVox, blueprint, onchainGenome, type OnchainG } from "@/lib/onchain-guardian";
import type { ParcelRect } from "@/lib/forge-parcels";
import { bwvxBoxes, type BwvxBox } from "@/lib/bwvx-export";
import { BLOCKS } from "@/lib/voxel-world";
import { createFlyBrain, type FlyBrain } from "@/lib/fly-brain";

/** BITMAP land side in scene units; the 64-cell parcel grid is scaled onto it. */
const LAND = 32;

/** Trailer length in seconds: PICK (0–2.5) → SUMMON (2.5–5.5) → INSCRIBE (5.5–8). */
export const TRAILER_S = 8;

export function GuardianStudio3D({ dna, animate = true, trailerStart = 0, onCanvas, parcels = [], owners = {}, baby = null, build = null }: { build?: { data: string; span?: number | undefined } | null; baby?: OnchainG | null; dna: GuardianDna; animate?: boolean; trailerStart?: number; onCanvas?: (c: HTMLCanvasElement | null) => void; parcels?: ParcelRect[]; owners?: Record<number, string> }) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const G = onchainGenome(dna), V = blueprint(G);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block"; renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0x9fb4d0, 0x101418, 0.9));
    const key = new THREE.DirectionalLight(0xfff3e0, 2.2); key.position.set(18, 30, 20); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -20, right: 20, top: 30, bottom: -5 }); key.shadow.radius = 4; key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x28e0ff, 1.4); rim.position.set(-16, 14, -22); scene.add(rim);
    const warm = new THREE.PointLight(0xf7931a, 40, 60); warm.position.set(-10, 4, 14); scene.add(warm);

    // The BITMAP's own land: square slab + its real Mondrian transaction parcels.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ opacity: 0.45 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.2; floor.receiveShadow = true; scene.add(floor);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(LAND, 1.2, LAND), new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.35, metalness: 0.6 }));
    ped.position.y = -0.6; ped.receiveShadow = true; ped.castShadow = true; scene.add(ped);
    const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(LAND, 1.2, LAND)), new THREE.LineBasicMaterial({ color: 0x28e0ff }));
    ring.position.y = -0.6; scene.add(ring);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3, emissive: 0xf7931a, emissiveIntensity: 0.04 });
    const list = parcels.slice(0, 6000);
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tileMat, Math.max(1, list.length));
    tiles.count = list.length; tiles.receiveShadow = true;
    {
      const span = list[0]?.span ?? 64, k = LAND / span, m = new THREE.Matrix4(), tc = new THREE.Color();
      list.forEach((p, i) => {
        const w = (p.x1 - p.x0) * k, d = (p.z1 - p.z0) * k, gap = Math.min(0.12, w * 0.15, d * 0.15);
        const h = 0.06 + Math.min(0.5, Math.log2(1 + p.size) * 0.05);
        m.compose(new THREE.Vector3((p.x0 + p.x1) / 2 * k - LAND / 2, h / 2, (p.z0 + p.z1) / 2 * k - LAND / 2), new THREE.Quaternion(), new THREE.Vector3(Math.max(0.05, w - gap), h, Math.max(0.05, d - gap)));
        tiles.setMatrixAt(i, m);
        // Bitcoin orange by default; each distinct on-chain owner gets its own hue.
        const o = owners[p.index];
        if (o) { let hsh = 0; for (let j = 0; j < o.length; j++) hsh = (hsh * 31 + o.charCodeAt(j)) >>> 0; tc.setHSL((hsh % 360) / 360, 0.75, 0.45); }
        else tc.setHSL(0.083, 0.93, 0.32 + ((p.index * 37) % 9) * 0.015);
        tiles.setColorAt(i, tc);
      });
      // Guardian stands on top of the parcel at the centre of its block.
      let top = 0; const c = span / 2;
      for (const p of list) if (p.x0 <= c && c < p.x1 && p.z0 <= c && c < p.z1) top = 0.06 + Math.min(0.5, Math.log2(1 + p.size) * 0.05);
      tiles.userData["top"] = top;
    }
    scene.add(tiles);

    // Ground height at any land point (parcel tile, then any build voxel above it).
    const pSpan = list[0]?.span ?? 64, pk = LAND / pSpan;
    let gBoxes: BwvxBox[] = [], gBs = 0, gTop0 = 0;
    const surfaceAt = (x: number, z: number) => {
      const gx = (x + LAND / 2) / pk, gz = (z + LAND / 2) / pk; let y = 0;
      for (const p of list) if (p.x0 <= gx && gx < p.x1 && p.z0 <= gz && gz < p.z1) { y = 0.06 + Math.min(0.5, Math.log2(1 + p.size) * 0.05); break; }
      if (gBoxes.length) {
        const bx = (x + LAND / 2) / gBs, bz = (z + LAND / 2) / gBs; let peak = -1;
        for (const b of gBoxes) if (b.x0 <= bx && bx < b.x1 + 1 && b.z0 <= bz && bz < b.z1 + 1) peak = Math.max(peak, b.y1);
        if (peak >= 0) y = gTop0 + (peak + 1) * gBs;
      }
      return y;
    };

    // Inscribed Land Forge build (verified from the BITMAP's sat), drawn on the land.
    if (build?.data) {
      let boxes: BwvxBox[] = [];
      try { boxes = bwvxBoxes(build.data); } catch { boxes = []; }
      if (boxes.length) {
        const span = build.span ?? 64, bs = LAND / span, top0 = tiles.userData["top"] as number;
        const bmesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 }), boxes.length);
        bmesh.castShadow = true; bmesh.receiveShadow = true;
        const bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), bp = new THREE.Vector3(), bsz = new THREE.Vector3(), bc = new THREE.Color();
        const c = span / 2; let peak = -1;
        boxes.forEach((b, i) => {
          const sx = b.x1 - b.x0 + 1, sy = b.y1 - b.y0 + 1, sz = b.z1 - b.z0 + 1;
          bp.set((b.x0 + sx / 2) * bs - LAND / 2, top0 + (b.y0 + sy / 2) * bs, (b.z0 + sz / 2) * bs - LAND / 2);
          bsz.set(sx * bs, sy * bs, sz * bs);
          bmesh.setMatrixAt(i, bm.compose(bp, bq, bsz));
          bmesh.setColorAt(i, bc.set(BLOCKS[b.k]?.top ?? "#888888"));
          if (b.x0 <= c && c <= b.x1 + 1 && b.z0 <= c && c <= b.z1 + 1) peak = Math.max(peak, b.y1);
        });
        scene.add(bmesh);
        gBoxes = boxes; gBs = bs; gTop0 = top0;
        // Guardian stands on the roof of whatever is built at the block's centre.
        if (peak >= 0) tiles.userData["top"] = top0 + (peak + 1) * bs;
      }
    }

    // One draw call for the whole creature.
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.12 });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, V.length);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const col = new THREE.Color();
    V.forEach((v, i) => { col.set(v[6]); if (v[7]) col.multiplyScalar(1 + v[7] * 0.6); mesh.setColorAt(i, col); });
    scene.add(mesh);
    const baseY = tiles.userData["top"] as number; mesh.position.y = baseY;
    // Verified on-chain baby (child inscription) stands beside its parent at pet scale.
    let babyMesh: THREE.InstancedMesh | null = null;
    let BV: ReturnType<typeof blueprint> = [];
    // Baby wanders on a fly brain seeded by its own genome, staying near its parent.
    const bState = { x: 9, z: 4, yaw: -0.5, speed: 0 };
    let bBrain: FlyBrain | null = null;
    if (baby) {
      BV = blueprint(baby);
      babyMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, BV.length);
      babyMesh.castShadow = true;
      const bc = new THREE.Color();
      BV.forEach((v, i) => { bc.set(v[6]); if (v[7]) bc.multiplyScalar(1 + v[7] * 0.6); babyMesh!.setColorAt(i, bc); });
      babyMesh.scale.setScalar(0.45);
      let s = 0; for (const ch of JSON.stringify(baby)) s = (Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0);
      bBrain = createFlyBrain(s / 4294967296 * 7 + 0.13);
      scene.add(babyMesh);
    }
    const bm4 = new THREE.Matrix4(), bq = new THREE.Quaternion(), bpos = new THREE.Vector3(), bscl = new THREE.Vector3();
    const stepBaby = (t: number, dt: number) => {
      if (!babyMesh || !baby || !bBrain) return;
      const d = Math.hypot(bState.x, bState.z);
      const act = bBrain.think({ now: t * 1000, hp: 1, maxHp: 1, snared: false, heading: bState.yaw, playerDistance: d, playerAngle: Math.atan2(-bState.x, -bState.z), workDistance: null, workAngle: 0, worker: false, hostile: false, vendor: false }, dt);
      if (animate) {
        bState.yaw += act.steer;
        // Leash: too far turns home, too close to the parent turns away.
        const home = Math.atan2(-bState.x, -bState.z);
        const diff = ((home - bState.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        if (d > 12) bState.yaw += diff * Math.min(1, dt * 3);
        else if (d < 6) bState.yaw -= Math.sign(diff || 1) * dt * 3;
        const target = act.state === "rest" ? 0 : 1.4 + act.throttle * 3.2;
        bState.speed += (target - bState.speed) * Math.min(1, dt * 4);
        bState.x += Math.sin(bState.yaw) * bState.speed * dt; bState.z += Math.cos(bState.yaw) * bState.speed * dt;
        const lim = LAND / 2 - 2; bState.x = Math.max(-lim, Math.min(lim, bState.x)); bState.z = Math.max(-lim, Math.min(lim, bState.z));
      }
      babyMesh.position.set(bState.x, surfaceAt(bState.x, bState.z), bState.z);
      babyMesh.rotation.y = bState.yaw;
      const moving = animate && bState.speed > 0.5;
      BV.forEach((v, i) => { const a = animate ? animVox(v, t, baby, moving, null) : v; bpos.set(a[0], a[1], a[2]); bscl.set(a[3], a[4], a[5]); babyMesh!.setMatrixAt(i, bm4.compose(bpos, bq, bscl)); });
      babyMesh.instanceMatrix.needsUpdate = true;
    };
    stepBaby(0, 0.016);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
    const place = (t: number) => {
      V.forEach((v, i) => { const a = animate ? animVox(v, t, G, false, null) : v; pos.set(a[0], a[1], a[2]); scl.set(a[3], a[4], a[5]); m4.compose(pos, q, scl); mesh.setMatrixAt(i, m4); });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(0);

    // Native orbit: drag, wheel, pinch, damped.
    let th = 0.6, ph = 1.2, r = 58, vth = 0.0025, vph = 0, drag = false, lx = 0, ly = 0, pinch = 0;
    const pts = new Map<number, { x: number; y: number }>();
    const cv = renderer.domElement;
    const down = (e: PointerEvent) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = true; lx = e.clientX; ly = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) r = Math.min(110, Math.max(28, r * pinch / d)); pinch = d; return; }
      vth = -(e.clientX - lx) * 0.006; vph = -(e.clientY - ly) * 0.006; lx = e.clientX; ly = e.clientY;
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; if (!pts.size) drag = false; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); r = Math.min(110, Math.max(28, r * (1 + e.deltaY * 0.001))); };
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", wheel, { passive: false });

    const size = () => { const w = el.offsetWidth, h = el.offsetHeight; renderer.setSize(w, h, false); cv.style.width = w + "px"; cv.style.height = h + "px"; cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
    size(); const ro = new ResizeObserver(size); ro.observe(el);

    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const tt = trailerStart ? (now - trailerStart) / 1000 : -1;
      if (tt >= 0 && tt < TRAILER_S) {
        // Scripted camera + reveal; blueprint shapes/colours untouched, only scale/light/camera.
        const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
        const reveal = ease((tt - 2.5) / 1.2);
        mesh.visible = tt >= 2.5; mesh.scale.setScalar(Math.max(0.001, reveal));
        mesh.position.y = baseY + (1 - reveal) * -6;
        const flash = tt >= 2.5 && tt < 3.1 ? 1 - (tt - 2.5) / 0.6 : 0;
        key.intensity = 2.2 + flash * 8; warm.intensity = 40 + flash * 300 + (tt > 5.5 ? 60 * Math.sin((tt - 5.5) * 9) ** 2 : 0);
        (ring.material as THREE.LineBasicMaterial).color.set(tt > 5.5 ? 0xf7931a : 0x28e0ff);
        tileMat.emissive.set(tt > 5.5 ? 0xf7931a : 0x28e0ff); tileMat.emissiveIntensity = tt > 5.5 ? 0.25 : tt >= 2.5 ? 0.08 + Math.min(1, (tt - 2.5) / 3) * 0.2 : 0.04;
        ring.scale.setScalar(1 + (tt < 2.5 ? 0.15 * Math.sin(tt * 6) : 0));
        const shake = flash * 0.8;
        const a = tt < 2.5 ? 2.4 - tt * 0.5 : tt < 5.5 ? 1.15 + (tt - 2.5) * 0.9 : 3.85 + (tt - 5.5) * 0.25;
        const rr = tt < 2.5 ? 95 - tt * 14 : tt < 5.5 ? 60 - ease((tt - 2.5) / 3) * 22 : 38 + (tt - 5.5) * 6;
        const hy = tt < 2.5 ? 40 - tt * 8 : 14 - ease((tt - 2.5) / 3) * 6;
        cam.position.set(Math.sin(a) * rr + (Math.random() - 0.5) * shake, hy + (Math.random() - 0.5) * shake, Math.cos(a) * rr);
        cam.lookAt(0, 9, 0);
      } else {
        mesh.visible = true; mesh.scale.setScalar(1); mesh.position.y = baseY; tileMat.emissive.set(0x28e0ff); tileMat.emissiveIntensity = 0.08; key.intensity = 2.2; warm.intensity = 40;
        th += vth; ph = Math.min(1.45, Math.max(0.35, ph + vph));
        const damp = Math.exp(-6 * dt); vph *= damp; vth = drag ? vth * damp : vth * damp + (1 - damp) * 0.0025;
        cam.position.set(Math.sin(th) * Math.sin(ph) * r, Math.cos(ph) * r + 9, Math.cos(th) * Math.sin(ph) * r); cam.lookAt(0, 9, 0);
      }
      if (animate) place(now / 1000);
      stepBaby(now / 1000, Math.min(0.05, dt));
      renderer.render(scene, cam);
      el.dataset["sceneReady"] = "1";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    onCanvas?.(cv);
    return () => {
      onCanvas?.(null);
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
      renderer.dispose(); cv.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dna, animate, trailerStart, parcels, owners, baby, build]);
  return <div ref={wrap} className="h-full w-full cursor-grab active:cursor-grabbing" aria-label={`${dna.height}.BITMAP Guardian 3D preview`} />;
}
