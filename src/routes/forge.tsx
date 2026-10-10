import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { BLOCKS } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { ARCHETYPES, encodeBuild, forgeInscriptionHtml, generateBuild, type ArchetypeId } from "@/lib/voxel-populate";

export const Route = createFileRoute("/forge")({
  validateSearch: (s: Record<string, unknown>): { height?: number } => {
    const h = Number(s["height"]);
    return Number.isInteger(h) && h >= 0 ? { height: h } : {};
  },
  head: () => ({
    meta: [
      { title: "Land Forge — Build & Inscribe Your BITMAP On-Chain" },
      { name: "description", content: "One-click voxel builds seeded by your BITMAP's own block, inscribed as a permanent child of your land on Bitcoin." },
      { property: "og:title", content: "Land Forge — On-Chain Builds for BITMAPs" },
      { property: "og:description", content: "Populate your BITMAP in one click and inscribe the build as a child on Bitcoin. Built land stands out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgePage,
});

const COLORS = Object.fromEntries(BLOCKS.map((b) => [b.id, new THREE.Color(b.top)]));

function BuildMesh({ blocks }: { blocks: TplBlock[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const center = useMemo(() => {
    let mx = 0, mz = 0;
    for (const b of blocks) { mx = Math.max(mx, b.dx); mz = Math.max(mz, b.dz); }
    return [mx / 2, mz / 2] as const;
  }, [blocks]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    blocks.forEach((b, i) => {
      o.position.set(b.dx - center[0], b.dy + 0.5, b.dz - center[1]);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, COLORS[b.k] ?? COLORS.stone!);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [blocks, center]);
  return (
    <instancedMesh key={blocks.length} ref={ref} args={[undefined, undefined, blocks.length]} castShadow receiveShadow>
      <boxGeometry args={[0.96, 0.96, 0.96]} />
      <meshStandardMaterial roughness={0.7} />
    </instancedMesh>
  );
}

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ForgePage() {
  const search = Route.useSearch();
  const [input, setInput] = useState(String(search.height ?? ""));
  const height = /^\d+$/.test(input) ? Number(input) : null;
  const [arch, setArch] = useState<ArchetypeId>("citadel");
  const [digest, setDigest] = useState<string | null>(null);
  const { data: sizes } = useQuery({ ...blockSizeMapQuery(height ?? 0), enabled: height !== null });
  const txCount = sizes?.classes?.length ?? null;

  const blocks = useMemo(() => (height === null ? [] : generateBuild(height, txCount, arch)), [height, txCount, arch]);
  const html = useMemo(() => (height === null ? "" : forgeInscriptionHtml(height, arch, blocks)), [height, arch, blocks]);
  const bytes = useMemo(() => new TextEncoder().encode(html).length, [html]);
  useEffect(() => {
    setDigest(null);
    if (!html) return;
    void sha(`forge:${encodeBuild(blocks)}`).then(setDigest);
  }, [html, blocks]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 font-mono">
      <p className="text-xs tracking-widest text-primary">LAND FORGE · ON-CHAIN BUILDS</p>
      <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">Populate your BITMAP. Inscribe it forever.</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Every build is grown from your block: its height seeds the layout and its transaction count sets the size. The build is
        inscribed as a child of your BITMAP on Bitcoin, so anyone can verify your land is built — on ordinals.com and in the Oasis.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="relative h-[460px] overflow-hidden rounded-lg border border-border bg-card/40">
          {height === null ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">ENTER A BITMAP NUMBER TO FORGE</div>
          ) : (
            <SafeCanvas shadows camera={{ position: [28, 24, 28], fov: 45 }}>
              <ambientLight intensity={0.55} />
              <directionalLight position={[20, 30, 10]} intensity={1.2} castShadow />
              <BuildMesh blocks={blocks} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[80, 80]} /><meshStandardMaterial color="#1b1f26" /></mesh>
              <OrbitControls autoRotate autoRotateSpeed={0.6} enablePan={false} />
            </SafeCanvas>
          )}
          {height !== null && (
            <div className="absolute left-3 top-3 rounded border border-border bg-background/70 px-2 py-1 text-[11px] text-accent backdrop-blur">
              {height.toLocaleString()}.BITMAP · {txCount ?? "…"} TX · {blocks.length} BLOCKS · {(bytes / 1024).toFixed(1)} KB
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <label className="block text-xs text-muted-foreground">
            BITMAP NUMBER
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="840000"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <div className="space-y-2">
            {ARCHETYPES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setArch(a.id)}
                className={`w-full rounded border px-3 py-2 text-left text-xs transition ${arch === a.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                <span className="block text-foreground">{a.name}</span>
                {a.blurb}
              </button>
            ))}
          </div>
          {height !== null && digest && (
            <div className="rounded border border-border bg-card/40 p-3">
              <ShadowInscriber
                key={digest}
                slug={`forge-${height}`}
                height={height}
                index={0}
                digest={digest}
                artifactLabel="INSCRIBE BUILD AS CHILD"
                actionLabel="INSCRIBE ON BITCOIN"
                description="Your wallet must hold this BITMAP. It is spent and returned to you in the same transaction to prove the build belongs to it."
                allowUpload={false}
                claimParentsForHeight={height}
                artifactVariants={[{ key: "html", label: "3D BUILD", contentType: "text/html;charset=utf-8", source: html, note: "Self-rendering build, no outside code." }]}
              />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Want to walk it first? <Link to="/oasis" search={height !== null ? ({ height } as never) : undefined} className="text-accent underline">Open the Oasis</Link>.
          </p>
        </aside>
      </div>
    </main>
  );
}
