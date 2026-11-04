/**
 * Three.js master-renderer preview. Reads the frozen on-chain blueprint (no change to
 * shapes or colours) and only upgrades projection: one InstancedMesh, studio lights,
 * soft contact shadow, native orbit/pinch controls. Sizes by offsetWidth (CSS-zoom safe).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GuardianDna } from "@/lib/bitmon";
import { animVox, blueprint, onchainGenome } from "@/lib/onchain-guardian";

/** Trailer length in seconds: PICK (0–2.5) → SUMMON (2.5–5.5) → INSCRIBE (5.5–8). */
export const TRAILER_S = 8;

export function GuardianStudio3D({ dna, animate = true, trailerStart = 0, onCanvas }: { dna: GuardianDna; animate?: boolean; trailerStart?: number; onCanvas?: (c: HTMLCanvasElement | null) => void }) {
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

    // Pedestal + floor catching the shadow.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.ShadowMaterial({ opacity: 0.45 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(15, 16, 1.2, 64), new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.35, metalness: 0.6 }));
    ped.position.y = -0.6; ped.receiveShadow = true; scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(15.4, 0.12, 8, 128), new THREE.MeshBasicMaterial({ color: 0x28e0ff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; scene.add(ring);

    // One draw call for the whole creature.
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.12 });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, V.length);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const col = new THREE.Color();
    V.forEach((v, i) => { col.set(v[6]); if (v[7]) col.multiplyScalar(1 + v[7] * 0.6); mesh.setColorAt(i, col); });
    scene.add(mesh);
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
        mesh.position.y = (1 - reveal) * -6;
        const flash = tt >= 2.5 && tt < 3.1 ? 1 - (tt - 2.5) / 0.6 : 0;
        key.intensity = 2.2 + flash * 8; warm.intensity = 40 + flash * 300 + (tt > 5.5 ? 60 * Math.sin((tt - 5.5) * 9) ** 2 : 0);
        (ring.material as THREE.MeshBasicMaterial).color.set(tt > 5.5 ? 0xf7931a : 0x28e0ff);
        ring.scale.setScalar(1 + (tt < 2.5 ? 0.15 * Math.sin(tt * 6) : 0));
        const shake = flash * 0.8;
        const a = tt < 2.5 ? 2.4 - tt * 0.5 : tt < 5.5 ? 1.15 + (tt - 2.5) * 0.9 : 3.85 + (tt - 5.5) * 0.25;
        const rr = tt < 2.5 ? 95 - tt * 14 : tt < 5.5 ? 60 - ease((tt - 2.5) / 3) * 22 : 38 + (tt - 5.5) * 6;
        const hy = tt < 2.5 ? 40 - tt * 8 : 14 - ease((tt - 2.5) / 3) * 6;
        cam.position.set(Math.sin(a) * rr + (Math.random() - 0.5) * shake, hy + (Math.random() - 0.5) * shake, Math.cos(a) * rr);
        cam.lookAt(0, 9, 0);
      } else {
        mesh.visible = true; mesh.scale.setScalar(1); mesh.position.y = 0; key.intensity = 2.2; warm.intensity = 40;
        th += vth; ph = Math.min(1.45, Math.max(0.35, ph + vph));
        const damp = Math.exp(-6 * dt); vph *= damp; vth = drag ? vth * damp : vth * damp + (1 - damp) * 0.0025;
        cam.position.set(Math.sin(th) * Math.sin(ph) * r, Math.cos(ph) * r + 9, Math.cos(th) * Math.sin(ph) * r); cam.lookAt(0, 9, 0);
      }
      if (animate) place(now / 1000);
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
  }, [dna, animate, trailerStart]);
  return <div ref={wrap} className="h-full w-full cursor-grab active:cursor-grabbing" aria-label={`${dna.height}.BITMAP Guardian 3D preview`} />;
}
