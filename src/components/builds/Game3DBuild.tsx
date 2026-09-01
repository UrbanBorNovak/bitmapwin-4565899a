import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  inscriptionContentUrl,
  seededRandom,
  type Game3dConfig,
} from "@/lib/build-sdk";

/**
 * A deterministic 3D world generated from the bitmap height, plus any on-chain
 * GLB/GLTF models the holder pointed at by inscription id. Drag to orbit, scroll
 * to zoom. Client-only: this module is lazy-imported after hydration.
 */
export default function Game3DBuild({ config, height }: { config: Game3dConfig; height: number }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [modelStatus, setModelStatus] = useState<string[]>([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 640;
    const h = 380;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.ground);
    if (config.fog) scene.fog = new THREE.Fog(config.ground, 40, 130);

    const camera = new THREE.PerspectiveCamera(55, width / h, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, h);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(20, 40, 15);
    scene.add(dir);
    const rim = new THREE.PointLight(new THREE.Color(config.accent), 40, 120);
    rim.position.set(-18, 14, -18);
    scene.add(rim);

    if (config.grid) scene.add(new THREE.GridHelper(80, 40, 0x2a2a2a, 0x1a1a1a));

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: config.ground, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    scene.add(floor);

    const rand = seededRandom(height);
    const accent = new THREE.Color(config.accent);
    const disposables: THREE.BufferGeometry[] = [];
    const world = new THREE.Group();
    const orbiters: THREE.Object3D[] = [];

    const mat = (accented: boolean) =>
      new THREE.MeshStandardMaterial({
        color: accented ? accent : new THREE.Color().setScalar(0.22 + rand() * 0.6),
        roughness: 0.7,
        metalness: 0.08,
      });

    if (config.scene === "city" || config.scene === "monoliths") {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      disposables.push(geo);
      const spread = config.scene === "monoliths" ? 70 : 60;
      for (let i = 0; i < config.towers; i++) {
        const tall = config.scene === "monoliths" ? 8 + rand() * 22 : 2 + rand() * 14;
        const box = new THREE.Mesh(geo, mat(rand() > 0.75));
        const s = config.scene === "monoliths" ? 2 + rand() * 2 : 1.5 + rand() * 2.5;
        box.scale.set(s, tall, s);
        box.position.set((rand() - 0.5) * spread, tall / 2, (rand() - 0.5) * spread);
        world.add(box);
      }
    } else if (config.scene === "pyramids") {
      for (let i = 0; i < config.towers; i++) {
        const size = 3 + rand() * 7;
        const geo = new THREE.ConeGeometry(size, size * (1 + rand()), 4, 1);
        disposables.push(geo);
        const cone = new THREE.Mesh(geo, mat(rand() > 0.8));
        cone.position.set((rand() - 0.5) * 70, (size * (1 + rand())) / 2, (rand() - 0.5) * 70);
        cone.rotation.y = Math.PI / 4;
        world.add(cone);
      }
    } else if (config.scene === "rings") {
      const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
      disposables.push(geo);
      for (let i = 0; i < config.towers; i++) {
        const ring = 10 + Math.floor(rand() * 3) * 9;
        const a = rand() * Math.PI * 2;
        const pivot = new THREE.Group();
        const box = new THREE.Mesh(geo, mat(rand() > 0.7));
        box.position.set(Math.cos(a) * ring, 3 + rand() * 12, Math.sin(a) * ring);
        pivot.add(box);
        pivot.userData["speed"] = (0.05 + rand() * 0.25) * (rand() > 0.5 ? 1 : -1);
        orbiters.push(pivot);
        world.add(pivot);
      }
    } else {
      // terrain: heightfield of thin columns seeded by the block
      const cells = Math.max(8, Math.min(28, config.towers));
      const geo = new THREE.BoxGeometry(1, 1, 1);
      disposables.push(geo);
      const step = 70 / cells;
      for (let x = 0; x < cells; x++) {
        for (let z = 0; z < cells; z++) {
          const tall = 0.4 + Math.abs(Math.sin(x * 0.6 + rand()) + Math.cos(z * 0.5)) * 5;
          const col = new THREE.Mesh(geo, mat(tall > 6.5));
          col.scale.set(step * 0.92, tall, step * 0.92);
          col.position.set(-35 + x * step + step / 2, tall / 2, -35 + z * step + step / 2);
          world.add(col);
        }
      }
    }
    scene.add(world);

    // ---- on-chain models -------------------------------------------------
    // Most ordinals GLBs are Draco compressed, so the decoder is always wired.
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(draco);
    const loaded: THREE.Object3D[] = [];
    const mixers: THREE.AnimationMixer[] = [];
    const spinners: THREE.Object3D[] = [];
    let cancelled = false;
    const statuses = config.models.map((m) => `LOADING ${m.label || m.inscriptionId.slice(0, 10)}…`);
    setModelStatus(statuses);

    config.models.forEach((model, index) => {
      const angle = (index / Math.max(1, config.models.length)) * Math.PI * 2;
      const radius = config.models.length > 1 ? 8 : 0;
      loader.load(
        inscriptionContentUrl(model.inscriptionId),
        (gltf) => {
          if (cancelled) return;
          const object = gltf.scene;
          // Normalise to a readable size, then apply the builder's scale.
          const box = new THREE.Box3().setFromObject(object);
          const size = box.getSize(new THREE.Vector3());
          const max = Math.max(size.x, size.y, size.z) || 1;
          const norm = 8 / max;
          object.scale.setScalar(norm * model.scale);
          const center = box.getCenter(new THREE.Vector3()).multiplyScalar(norm * model.scale);
          object.position.set(
            Math.cos(angle) * radius - center.x,
            model.height - box.min.y * norm * model.scale,
            Math.sin(angle) * radius - center.z,
          );
          scene.add(object);
          if (gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(object);
            mixer.clipAction(gltf.animations[0]!).play();
            mixers.push(mixer);
          }
          loaded.push(object);
          if (model.spin) spinners.push(object);
          setModelStatus((prev) => {
            const next = [...prev];
            next[index] = `${model.label || model.inscriptionId.slice(0, 10)} LOADED`;
            return next;
          });
        },
        undefined,
        () => {
          if (cancelled) return;
          setModelStatus((prev) => {
            const next = [...prev];
            next[index] = `${model.label || model.inscriptionId.slice(0, 10)} — NOT A GLB / NOT FOUND`;
            return next;
          });
        },
      );
    });

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
      radius = Math.min(160, Math.max(12, radius * Math.exp(dy * 0.0015)));
      place();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      if (config.spin && !dragging) {
        theta += 0.0015;
        place();
      }
      for (const pivot of orbiters) pivot.rotation.y += (pivot.userData["speed"] as number) * delta;
      for (const object of spinners) object.rotation.y += delta * 0.5;
      for (const mixer of mixers) mixer.update(delta);
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
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      for (const geo of disposables) geo.dispose();
      const cleanup = (root: THREE.Object3D) =>
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            (o.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
            const m = o.material as THREE.Material | THREE.Material[];
            if (Array.isArray(m)) m.forEach((x) => x.dispose());
            else m?.dispose?.();
          }
        });
      cleanup(world);
      loaded.forEach(cleanup);
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, [
    config.accent,
    config.fog,
    config.grid,
    config.ground,
    config.models,
    config.scene,
    config.spin,
    config.towers,
    height,
  ]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="display text-sm">{config.worldName.toUpperCase()}</span>
        <span className="label">DRAG TO ORBIT · SCROLL TO ZOOM</span>
      </div>
      <div ref={mountRef} className="overflow-hidden rounded-md border border-border" />
      {modelStatus.length > 0 ? (
        <p className="label text-muted-foreground">
          ON-CHAIN MODELS: {modelStatus.join(" · ").toUpperCase()}
        </p>
      ) : null}
    </div>
  );
}
