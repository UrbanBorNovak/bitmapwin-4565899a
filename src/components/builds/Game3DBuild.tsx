import { useEffect, useRef } from "react";
import * as THREE from "three";
import { seededRandom, type Game3dConfig } from "@/lib/build-sdk";

/**
 * A deterministic voxel skyline generated from the bitmap height. Drag to orbit,
 * scroll to zoom. Client-only: this module is lazy-imported after hydration.
 */
export default function Game3DBuild({ config, height }: { config: Game3dConfig; height: number }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 640;
    const h = 380;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0a0a");
    scene.fog = new THREE.Fog("#0a0a0a", 40, 120);

    const camera = new THREE.PerspectiveCamera(55, width / h, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, h);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(20, 40, 15);
    scene.add(dir);

    const grid = new THREE.GridHelper(80, 40, 0x2a2a2a, 0x1a1a1a);
    scene.add(grid);

    const rand = seededRandom(height);
    const accent = new THREE.Color(config.accent);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const world = new THREE.Group();
    for (let i = 0; i < config.towers; i++) {
      const tall = 2 + rand() * 14;
      const mat = new THREE.MeshStandardMaterial({
        color: rand() > 0.75 ? accent : new THREE.Color().setScalar(0.25 + rand() * 0.6),
        roughness: 0.7,
        metalness: 0.05,
      });
      const box = new THREE.Mesh(geo, mat);
      const s = 1.5 + rand() * 2.5;
      box.scale.set(s, tall, s);
      box.position.set((rand() - 0.5) * 60, tall / 2, (rand() - 0.5) * 60);
      world.add(box);
    }
    scene.add(world);

    let theta = 0.6;
    let phi = 0.9;
    let radius = 55;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function place() {
      camera.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        Math.max(4, radius * Math.cos(phi)),
        radius * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(0, 4, 0);
    }
    place();

    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      theta -= (e.clientX - lastX) * 0.005;
      phi = Math.min(1.45, Math.max(0.15, phi - (e.clientY - lastY) * 0.005));
      lastX = e.clientX;
      lastY = e.clientY;
      place();
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      radius = Math.min(140, Math.max(15, radius * Math.exp(dy * 0.0015)));
      place();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    const tick = () => {
      if (config.spin && !dragging) {
        theta += 0.0015;
        place();
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      const w = mount.clientWidth || width;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      geo.dispose();
      world.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
      });
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, [config.accent, config.spin, config.towers, height]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="display text-sm">{config.worldName.toUpperCase()}</span>
        <span className="label">DRAG TO ORBIT · SCROLL TO ZOOM</span>
      </div>
      <div ref={mountRef} className="overflow-hidden rounded-md border border-border" />
    </div>
  );
}
