import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";

const cache = new Map<string, Promise<string | null>>();

/** BRC-420 pixel avatars are HTML that declare a PNG texture; resolve the texture id (or the id itself if it is already an image). */
export function resolvePixelTexture(id: string): Promise<string | null> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/api/public/inscription/${id}`).then(async (r) => {
      if (!r.ok) return null;
      if ((r.headers.get("content-type") ?? "").startsWith("image/")) return id;
      const m = (await r.text()).match(/<texture[^>]*src=["']\/content\/([0-9a-f]{64}i\d+)/i);
      return m ? m[1]! : null;
    }).catch(() => null);
    cache.set(id, p);
  }
  return p;
}

function Spin({ tex }: { tex: string }) {
  const g = useRef<Group>(null);
  const still = useRef(false);
  useFrame((_, d) => { if (g.current) g.current.rotation.y += d * 0.6; });
  return <group ref={g} position-y={-0.62}><ToonPixelRig inscriptionId={tex} pose="idle" movingRef={still} fallback={null} /></group>;
}

/** Rotating 3D rig wearing a BITMAP Pixel's own texture; mounts only when scrolled into view. */
export function PixelAvatar3D({ inscriptionId, label }: { inscriptionId: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [tex, setTex] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(!!e?.isIntersecting), { rootMargin: "100px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    let live = true; setTex(undefined);
    resolvePixelTexture(inscriptionId).then((t) => { if (live) setTex(t); });
    return () => { live = false; };
  }, [inscriptionId]);
  return (
    <div ref={box} role="img" aria-label={label} className="relative aspect-square w-full bg-background">
      {seen && tex && (
        <SafeCanvas camera={{ position: [0, 0.1, 2.2], fov: 35 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 3, 2]} intensity={1.4} />
          <Suspense fallback={null}><Spin tex={tex} /></Suspense>
        </SafeCanvas>
      )}
      {tex === null && <span className="absolute inset-0 grid place-items-center font-mono text-[10px] text-muted-foreground">no texture</span>}
      {tex === undefined && <span className="absolute inset-0 grid place-items-center font-mono text-[10px] text-muted-foreground">loading…</span>}
    </div>
  );
}
