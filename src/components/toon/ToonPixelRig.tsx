import { Component, Suspense, useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import { resolvePixelTexture } from "@/lib/pixel-texture";
import { useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import { DEFAULT_AVATAR_MODEL } from "@/lib/map-identity";
import { rigClipFor, rigGesture } from "@/lib/toon-avatars";

const MODEL_URL = `/api/public/inscription/${DEFAULT_AVATAR_MODEL}`;
/** Same body height as the voxel avatars, so framing and bubbles stay put. */
const RIG_HEIGHT = 1.25;
const skinUrl = (id: string, attempt: number) => `/api/public/inscription/${id}${attempt ? `?retry=${attempt}` : ""}`;

/** The canonical on-chain GLB rig wearing a BITMAP Pixel inscription on its own UVs — the Oasis pipeline.
 * Poses play the rig's baked skeletal clips; gestures it never baked are layered onto its own arm/head bones. */
function Rig({ inscriptionId, tint, pose, movingRef, timeRef, attempt }: { inscriptionId: string; tint?: string | undefined; pose: string; movingRef: MutableRefObject<boolean>; timeRef?: MutableRefObject<number> | undefined; attempt: number }) {
  const gltf = useGLTF(MODEL_URL);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions, names, mixer } = useAnimations(gltf.animations, scene);
  const texture = useTexture(skinUrl(inscriptionId, attempt));
  const bones = useMemo(() => {
    const by = (n: string) => scene.getObjectByName(n) ?? null;
    // Armature names are mirrored ("Arm.L" sits under "RightArm"); use the deforming bones.
    return { armL: by("Arm.L"), armR: by("Arm.R"), head: by("Head"), legL: by("Leg.L"), legR: by("Leg.R") };
  }, [scene]);

  useEffect(() => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    const made: THREE.Material[] = [];
    const paint = (source: THREE.Material) => {
      const m = source.clone() as THREE.MeshStandardMaterial;
      m.map = texture; m.color = new THREE.Color(tint ?? "#ffffff");
      m.metalness = 0; m.roughness = 0.85; m.envMapIntensity = 0.25;
      m.transparent = false; m.depthWrite = true; m.alphaTest = 0.5; m.side = THREE.FrontSide;
      m.needsUpdate = true; made.push(m);
      return m;
    };
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; mesh.castShadow = true;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paint) : paint(mesh.material);
    });
    return () => made.forEach((m) => m.dispose());
  }, [scene, texture, tint]);

  const fitted = useMemo(() => {
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(scene, true);
    const size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    return { fit: RIG_HEIGHT / Math.max(size.y, 0.0001), c, minY: b.min.y };
  }, [scene]);

  // Rest pose per bone: every frame starts from it, so gestures never accumulate while looping or scrubbing.
  const rest = useMemo(() => {
    const m = new Map<THREE.Object3D, THREE.Quaternion>();
    for (const b of Object.values(bones)) if (b) m.set(b, b.quaternion.clone());
    return m;
  }, [bones]);
  const q = useMemo(() => new THREE.Quaternion(), []), ax = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  // Baked clips are sampled at the episode clock (not wall-clock), so playback, scrubbing and export show the same frame.
  // Subscribed after useAnimations, so this overrides its wall-clock update each frame.
  useFrame(() => {
    const t = timeRef?.current ?? performance.now() / 1000;
    const moving = movingRef.current;
    const pick = rigClipFor(names, pose, moving);
    const next = pick.name ? actions[pick.name] : null;
    for (const b of rest.keys()) b.quaternion.copy(rest.get(b)!);
    if (next) {
      for (const n of names) { const a = actions[n]; if (a && a !== next && a.isRunning()) a.stop(); }
      if (!next.isRunning()) next.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      next.enabled = true; next.setEffectiveWeight(1); next.setEffectiveTimeScale(1);
      const d = next.getClip().duration || 1;
      next.time = ((t * pick.speed) % d + d) % d;
      mixer.update(0);
    }
    const g = rigGesture(pose, t, moving);
    const layer = (b: THREE.Object3D | null, r: number) => { if (b && r) b.quaternion.multiply(q.setFromAxisAngle(ax, r)); };
    layer(bones.armL, g.armL); layer(bones.armR, g.armR); layer(bones.head, g.head);
    layer(bones.legL, g.legL); layer(bones.legR, g.legR);
  });

  return (
    <group scale={fitted.fit} position={[-fitted.c.x * fitted.fit, -fitted.minY * fitted.fit, -fitted.c.z * fitted.fit]}>
      <Primitive object={scene} />
    </group>
  );
}

/** A failed rig/skin load falls back to the voxel body instead of blanking the actor. */
const MAX_RETRIES = 3;
class RigBoundary extends Component<{ fallback: ReactNode; children: (attempt: number) => ReactNode; resetKey: string; onFail: (attempt: number) => void }, { failed: boolean; attempt: number }> {
  override state = { failed: false, attempt: 0 };
  timer: ReturnType<typeof setTimeout> | undefined;
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() {
    const a = this.state.attempt;
    this.props.onFail(a);
    if (a >= MAX_RETRIES) return;
    // Retry the model/skin after a backoff; the voxel body stands in meanwhile.
    this.timer = setTimeout(() => this.setState({ failed: false, attempt: a + 1 }), 900 * (a + 1));
  }
  override componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && (this.state.failed || this.state.attempt)) { clearTimeout(this.timer); this.setState({ failed: false, attempt: 0 }); }
  }
  override componentWillUnmount() { clearTimeout(this.timer); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children(this.state.attempt); }
}

export function ToonPixelRig({ inscriptionId: rawId, tint, pose, movingRef, timeRef, fallback }: { inscriptionId: string; tint?: string | undefined; pose: string; movingRef: MutableRefObject<boolean>; timeRef?: MutableRefObject<number> | undefined; fallback: ReactNode }) {
  // Gallery pixels are often BRC-420 HTML: follow it to the PNG it declares before painting the rig.
  const [res, setRes] = useState<{ raw: string; tex: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    resolvePixelTexture(rawId).then((tex) => { if (live) setRes({ raw: rawId, tex }); });
    return () => { live = false; };
  }, [rawId]);
  if (!res || res.raw !== rawId) return <>{fallback}</>;
  if (!res.tex) return <>{fallback}</>;
  const inscriptionId = res.tex;
  return (
    <RigBoundary
      fallback={fallback}
      resetKey={inscriptionId}
      onFail={(a) => { useGLTF.clear(MODEL_URL); useTexture.clear(skinUrl(inscriptionId, a)); }}
    >
      {(attempt) => (
        <Suspense fallback={fallback}>
          <Rig inscriptionId={inscriptionId} tint={tint} pose={pose} movingRef={movingRef} timeRef={timeRef} attempt={attempt} />
        </Suspense>
      )}
    </RigBoundary>
  );
}
