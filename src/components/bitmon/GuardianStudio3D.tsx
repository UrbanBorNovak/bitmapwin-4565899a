/**
 * Three.js master-renderer preview. Reads the frozen on-chain blueprint (no change to
 * shapes or colours) and only upgrades projection: one InstancedMesh, studio lights,
 * soft contact shadow, native orbit/pinch controls. Sizes by offsetWidth (CSS-zoom safe).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GuardianDna } from "@/lib/bitmon";
import { animVox, blueprint, onchainGenome } from "@/lib/onchain-guardian";

export function GuardianStudio3D({ dna, animate = true }: { dna: GuardianDna; animate?: boolean }) {
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
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) r = Math.min(110, Math.max(28, r * pinch / d)); pinch = d; return; }
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
      th += vth; ph = Math.min(1.45, Math.max(0.35, ph + vph));
      const damp = Math.exp(-6 * dt); vph *= damp; vth = drag ? vth * damp : vth * damp + (1 - damp) * 0.0025;
      cam.position.set(Math.sin(th) * Math.sin(ph) * r, Math.cos(ph) * r + 9, Math.cos(th) * Math.sin(ph) * r); cam.lookAt(0, 9, 0);
      if (animate) place(now / 1000);
      renderer.render(scene, cam);
      el.dataset.sceneReady = "1";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
      renderer.dispose(); cv.remove();
    };
  }, [dna, animate]);
  return <div ref={wrap} className="h-full w-full cursor-grab active:cursor-grabbing" aria-label={`${dna.height}.BITMAP Guardian 3D preview`} />;
}
