import { Component, Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import { DEFAULT_AVATAR_MODEL } from "@/lib/map-identity";
import { rigClipFor, rigGesture } from "@/lib/toon-avatars";

const MODEL_URL = `https://ordinals.com/content/${DEFAULT_AVATAR_MODEL}`;
/** Same body height as the voxel avatars, so framing and bubbles stay put. */
const RIG_HEIGHT = 1.25;
const skinUrl = (id: string, attempt: number) => `/api/public/inscription/${id}${attempt ? `?retry=${attempt}` : ""}`;

/** The canonical on-chain GLB rig wearing a BITMAP Pixel inscription on its own UVs — the Oasis pipeline.
 * Poses play the rig's baked skeletal clips; gestures it never baked are layered onto its own arm/head bones. */
function Rig({ inscriptionId, tint, pose, movingRef, timeRef, attempt }: { inscriptionId: string; tint?: string; pose: string; movingRef: MutableRefObject<boolean>; timeRef?: MutableRefObject<number>; attempt: number }) {
  const gltf = useGLTF(MODEL_URL);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  const texture = useTexture(skinUrl(inscriptionId, attempt));
  const bones = useMemo(() => {
    const by = (n: string) => scene.getObjectByName(n) ?? null;
    // Armature names are mirrored ("Arm.L" sits under "RightArm"); use the deforming bones.
    return { armL: by("Arm.L"), armR: by("Arm.R"), head: by("Head") };
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
    const b = new THREE.Box3().setFromObject(scene);
    const size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    return { fit: RIG_HEIGHT / Math.max(size.y, 0.0001), c, minY: b.min.y };
  }, [scene]);

  // Cross-fade between baked clips (Oasis style: stop every other clip so bones never fight).
  const active = useRef<THREE.AnimationAction | null>(null);
  const moving = useRef(false);
  useEffect(() => {
    const apply = () => {
      const pick = rigClipFor(names, pose, moving.current);
      const next = pick.name ? actions[pick.name] : null;
      if (!next) return;
      next.setEffectiveTimeScale(pick.speed);
      if (next === active.current) return;
      next.enabled = true;
      next.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
      if (active.current) active.current.crossFadeTo(next, 0.2, false);
      for (const [k, a] of Object.entries(actions)) if (a && a !== next && a !== active.current && k) a.stop();
      active.current = next;
    };
    apply();
    const id = setInterval(() => {
      if (moving.current !== movingRef.current) { moving.current = movingRef.current; apply(); }
    }, 150);
    return () => clearInterval(id);
  }, [actions, names, pose, movingRef]);

  // Subscribed after useAnimations, so this runs once the mixer wrote the clip pose, layer the gesture onto the real bones.
  const q = useMemo(() => new THREE.Quaternion(), []), ax = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  useFrame(() => {
    const g = rigGesture(pose, timeRef?.current ?? performance.now() / 1000, movingRef.current);
    if (bones.armL && g.armL) bones.armL.quaternion.multiply(q.setFromAxisAngle(ax, g.armL));
    if (bones.armR && g.armR) bones.armR.quaternion.multiply(q.setFromAxisAngle(ax, g.armR));
    if (bones.head && g.head) bones.head.quaternion.multiply(q.setFromAxisAngle(ax, g.head));
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

export function ToonPixelRig({ inscriptionId, tint, pose, movingRef, timeRef, fallback }: { inscriptionId: string; tint?: string; pose: string; movingRef: MutableRefObject<boolean>; timeRef?: MutableRefObject<number>; fallback: ReactNode }) {
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
