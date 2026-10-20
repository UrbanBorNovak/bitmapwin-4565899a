import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, NearestFilter, SRGBColorSpace, type Group } from "three";
import { AVATAR_SKINS, MODEL_SHAPE, isPixelSkin, limbPose, type ToonAvatar } from "@/lib/toon-avatars";

/** Pixel texture for a skin, drawn once per skin so exports bake the same pattern. */
function useSkinTexture(skinId: string) {
  const [pixel, setPixel] = useState<{ t: CanvasTexture; s: (typeof AVATAR_SKINS)[number] } | null>(null);
  const tex = useMemo(() => {
    const s = AVATAR_SKINS.find((k) => k.v === skinId) ?? AVATAR_SKINS[0]!;
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const x = c.getContext("2d")!;
    x.fillStyle = s.base; x.fillRect(0, 0, 32, 32); x.fillStyle = s.accent;
    let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (s.pattern === "stripes") for (let y = 0; y < 32; y += 8) x.fillRect(0, y, 32, 3);
    if (s.pattern === "checker") for (let y = 0; y < 32; y += 8) for (let i = 0; i < 32; i += 8) if ((i + y) % 16 === 0) x.fillRect(i, y, 8, 8);
    if (s.pattern === "circuit") { x.fillRect(4, 0, 2, 32); x.fillRect(4, 14, 20, 2); x.fillRect(22, 14, 2, 18); x.fillRect(14, 4, 14, 2); x.fillRect(12, 24, 4, 4); }
    if (s.pattern === "camo") for (let i = 0; i < 14; i++) x.fillRect(Math.floor(r() * 28), Math.floor(r() * 28), 4 + Math.floor(r() * 6), 3 + Math.floor(r() * 4));
    if (s.pattern === "petals") for (let i = 0; i < 10; i++) { const px = Math.floor(r() * 30), py = Math.floor(r() * 30); x.fillRect(px, py, 2, 2); x.fillRect(px + 2, py + 1, 1, 1); }
    if (s.pattern === "solid") { x.globalAlpha = 0.5; x.fillRect(0, 0, 32, 2); x.fillRect(0, 30, 32, 2); }
    const t = new CanvasTexture(c); t.magFilter = t.minFilter = NearestFilter; t.colorSpace = SRGBColorSpace;
    return { t, s };
  }, [skinId]);
  useEffect(() => () => tex.t.dispose(), [tex]);
  // On-chain BITMAP Pixel: paint the real inscription image, and take skin/accent tones from its own pixels.
  useEffect(() => {
    setPixel(null);
    if (!isPixelSkin(skinId)) return;
    let live = true, made: CanvasTexture | null = null, tries = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const img = new Image(); img.crossOrigin = "anonymous";
    // A failed load keeps the studio texture visible and retries a few times (ordinals.com rate-limits bursts).
    img.onerror = () => { if (live && ++tries < 4) timer = setTimeout(() => { img.src = `/api/public/inscription/${skinId.slice(3)}?retry=${tries}`; }, 800 * tries); };
    img.onload = () => {
      if (!live) return;
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const x = c.getContext("2d")!; x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 64, 64);
      let accent = "#f7931a", skin = "#e8b48a";
      try {
        const d = x.getImageData(0, 0, 64, 64).data, counts = new Map<string, number>();
        for (let i = 0; i < d.length; i += 16) if (d[i + 3]! > 200) { const k = `${d[i]! >> 4},${d[i + 1]! >> 4},${d[i + 2]! >> 4}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => { const [r, g, b] = k.split(",").map((n) => Number(n) * 16 + 8); return `rgb(${r},${g},${b})`; });
        if (top[0]) skin = top[0]; if (top[1]) accent = top[1];
      } catch { /* tainted canvas: keep defaults */ }
      made = new CanvasTexture(c); made.magFilter = made.minFilter = NearestFilter; made.colorSpace = SRGBColorSpace;
      setPixel({ t: made, s: { ...AVATAR_SKINS[0]!, base: skin, accent, skin } });
    };
    img.src = `/api/public/inscription/${skinId.slice(3)}`;
    return () => { live = false; clearTimeout(timer); made?.dispose(); };
  }, [skinId]);
  return pixel ?? tex;
}

/** Voxel avatar with pivoted limbs, animated per pose from the shared time ref. */
export function ToonAvatarBody({ avatar, pose, timeRef, movingRef }: { avatar: ToonAvatar; pose: string; timeRef: MutableRefObject<number>; movingRef: MutableRefObject<boolean> }) {
  const { t: tex, s } = useSkinTexture(avatar.skin);
  const sh = MODEL_SHAPE[avatar.model];
  const aL = useRef<Group>(null), aR = useRef<Group>(null), lL = useRef<Group>(null), lR = useRef<Group>(null), hd = useRef<Group>(null);
  useFrame(() => {
    const p = limbPose(pose, timeRef.current, movingRef.current);
    if (aL.current) aL.current.rotation.x = p.armL;
    if (aR.current) aR.current.rotation.x = p.armR;
    if (lL.current) lL.current.rotation.x = p.legL;
    if (lR.current) lR.current.rotation.x = p.legR;
    if (hd.current) hd.current.rotation.z = p.head;
  });
  const [tw, th, td] = sh.torso, hipY = sh.leg, shY = hipY + th, armLen = th * 0.95;
  const cloth = <meshStandardMaterial map={tex} roughness={0.8} />;
  const skin = <meshStandardMaterial color={avatar.model === "bot" ? "#9aa5b1" : s.skin} roughness={0.7} metalness={avatar.model === "bot" ? 0.15 : 0} />;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={`l${side}`} ref={side < 0 ? lL : lR} position={[side * tw * 0.25, hipY, 0]}>
          <mesh position={[0, -sh.leg / 2, 0]} castShadow><boxGeometry args={[sh.limb * 1.2, sh.leg, sh.limb * 1.2]} />{cloth}</mesh>
        </group>
      ))}
      <mesh position={[0, hipY + th / 2, 0]} castShadow><boxGeometry args={[tw, th, td]} />{cloth}</mesh>
      {[-1, 1].map((side) => (
        <group key={`a${side}`} ref={side < 0 ? aL : aR} position={[side * (tw / 2 + sh.limb / 2), shY - 0.02, 0]}>
          <mesh position={[0, -armLen / 2, 0]} castShadow><boxGeometry args={[sh.limb, armLen, sh.limb]} />{cloth}</mesh>
          <mesh position={[0, -armLen, 0]}><boxGeometry args={[sh.limb * 1.1, sh.limb, sh.limb * 1.1]} />{skin}</mesh>
        </group>
      ))}
      <group ref={hd} position={[0, shY, 0]}>
        <mesh position={[0, sh.head / 2 + 0.02, 0]} castShadow><boxGeometry args={[sh.head, sh.head, sh.head]} />{skin}</mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * sh.head * 0.22, sh.head * 0.6, sh.head / 2 + 0.021]}>
            <planeGeometry args={[sh.head * 0.14, sh.head * 0.18]} /><meshBasicMaterial color={avatar.model === "bot" ? s.accent : "#111"} />
          </mesh>
        ))}
        {avatar.model === "runner" && <mesh position={[0, sh.head + 0.03, -0.02]}><boxGeometry args={[sh.head * 1.05, 0.06, sh.head * 1.05]} />{cloth}</mesh>}
        {avatar.model === "bot" && <mesh position={[0, sh.head + 0.12, 0]}><boxGeometry args={[0.03, 0.16, 0.03]} /><meshStandardMaterial color={s.accent} emissive={s.accent} emissiveIntensity={0.6} /></mesh>}
        {avatar.model === "wizard" && <mesh position={[0, sh.head + 0.17, 0]}><coneGeometry args={[sh.head * 0.75, 0.34, 4]} />{cloth}</mesh>}
        {avatar.model === "vendetta" && <mesh position={[0, sh.head + 0.04, 0]}><cylinderGeometry args={[sh.head * 0.9, sh.head * 0.9, 0.03, 16]} /><meshStandardMaterial color="#111" /></mesh>}
        {avatar.model === "bruiser" && <mesh position={[0, sh.head * 0.25, sh.head / 2 + 0.03]}><boxGeometry args={[sh.head * 0.9, 0.05, 0.04]} /><meshStandardMaterial color={s.accent} /></mesh>}
      </group>
    </group>
  );
}

/** Per-model gear worn over the on-chain rig (rig height 1.25, facing +z), so every cast member reads differently. */
export function ModelGear({ model, accent }: { model: ToonAvatar["model"]; accent: string }) {
  if (model === "vendetta") return (
    <group>
      {/* White theatrical mask: pale face, rosy cheeks, upturned moustache, thin goatee, arched brows */}
      <mesh position={[0, 1.04, 0.14]}><boxGeometry args={[0.24, 0.28, 0.03]} /><meshStandardMaterial color="#f4f1ea" roughness={0.4} /></mesh>
      {[-1, 1].map((s) => <group key={s}>
        <mesh position={[s * 0.06, 1.1, 0.158]}><boxGeometry args={[0.05, 0.02, 0.01]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh position={[s * 0.065, 1.14, 0.158]} rotation={[0, 0, s * -0.35]}><boxGeometry args={[0.07, 0.012, 0.01]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh position={[s * 0.08, 1.02, 0.158]}><boxGeometry args={[0.04, 0.03, 0.01]} /><meshBasicMaterial color="#e8a0a0" /></mesh>
        <mesh position={[s * 0.05, 0.99, 0.16]} rotation={[0, 0, s * 0.45]}><boxGeometry args={[0.07, 0.018, 0.01]} /><meshBasicMaterial color="#111" /></mesh>
      </group>)}
      <mesh position={[0, 0.93, 0.16]}><boxGeometry args={[0.015, 0.05, 0.01]} /><meshBasicMaterial color="#111" /></mesh>
      {/* Wide-brim black hat and cloak */}
      <mesh position={[0, 1.24, 0]}><cylinderGeometry args={[0.24, 0.24, 0.02, 20]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0, 1.31, 0]}><cylinderGeometry args={[0.12, 0.14, 0.13, 20]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0, 1.26, 0]}><cylinderGeometry args={[0.142, 0.142, 0.025, 20]} /><meshStandardMaterial color={accent} /></mesh>
      <mesh position={[0, 0.62, -0.13]} rotation={[0.08, 0, 0]}><boxGeometry args={[0.46, 0.8, 0.03]} /><meshStandardMaterial color="#141416" /></mesh>
    </group>
  );
  if (model === "wizard") return <mesh position={[0, 1.36, 0]}><coneGeometry args={[0.17, 0.36, 6]} /><meshStandardMaterial color={accent} /></mesh>;
  if (model === "bot") return (
    <group>
      <mesh position={[0, 1.08, 0.14]}><boxGeometry args={[0.22, 0.07, 0.03]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} /></mesh>
      <mesh position={[0, 1.34, 0]}><boxGeometry args={[0.025, 0.18, 0.025]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} /></mesh>
    </group>
  );
  if (model === "bruiser") return (
    <group>
      <mesh position={[0, 1.08, 0.14]}><boxGeometry args={[0.24, 0.05, 0.03]} /><meshStandardMaterial color="#111" /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.2, 0.86, 0]}><boxGeometry args={[0.14, 0.08, 0.2]} /><meshStandardMaterial color={accent} /></mesh>)}
    </group>
  );
  return <mesh position={[0, 1.24, 0.03]}><boxGeometry args={[0.24, 0.04, 0.3]} /><meshStandardMaterial color={accent} /></mesh>;
}
