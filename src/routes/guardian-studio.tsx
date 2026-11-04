import { useMemo, useRef, useState } from "react";
import { TRAILER_S } from "@/components/bitmon/GuardianStudio3D";
import { MintTrailerOverlay, playTrailerSfx, renderTrailerAudio, drawTrailerCaptions } from "@/components/bitmon/MintTrailerOverlay";
import { X_SIZES, canEncodeMp4, createXRecorder } from "@/lib/x-video";
import { onchainGuardianName } from "@/lib/onchain-name";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery, guardianDnaQuery, guardianQuery } from "@/lib/bitmon-queries";
import { guardianBabiesQuery } from "@/lib/guardian-babies";
import { breedPet, type PetParent } from "@/lib/guardian-genetics";
import { onchainGenome } from "@/lib/onchain-guardian";
import { Link } from "@tanstack/react-router";
import { GuardianStudio3D } from "@/components/bitmon/GuardianStudio3D";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { parcelRects } from "@/lib/forge-parcels";
import { forgeBuildQuery } from "@/lib/forge";
import { parcelOwnersFn } from "@/lib/parcel-owners.functions";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";

export const Route = createFileRoute("/guardian-studio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guardian Studio · Three.js Renderer Preview — BITMAPWIN" },
      { name: "description", content: "Preview any BITMAP Guardian in a Three.js studio renderer built on the same frozen on-chain voxel blueprint." },
      { property: "og:title", content: "Guardian Studio — BITMAPWIN" },
      { property: "og:description", content: "Studio lighting, soft shadows and orbit controls for the same on-chain Guardian blueprint." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const [input, setInput] = useState("840000");
  const [height, setHeight] = useState(840000);
  const [animate, setAnimate] = useState(true);
  const q = useQuery({ ...guardianDnaQuery(height), staleTime: Infinity });
  const sizes = useQuery(blockSizeMapQuery(height));
  const parcels = useMemo(() => parcelRects(sizes.data?.classes), [sizes.data]);
  const ownerQ = useQuery({ queryKey: ["parcel-owners", height], queryFn: () => parcelOwnersFn({ data: { height } }), staleTime: 600_000 });
  const owners = useMemo(() => Object.fromEntries((ownerQ.data ?? []).filter((o) => o.owner).map((o) => [o.index, o.owner as string])), [ownerQ.data]);
  const ownerCount = new Set(Object.values(owners)).size;
  const awake = useQuery(guardianQuery(height));
  const selfId = awake.data?.inscriptionId ?? null;
  const babiesQ = useQuery(guardianBabiesQuery(selfId));
  const babies = babiesQ.data ?? [];
  const roster = useQuery(allGuardiansQuery()).data ?? [];
  const first = babies[0];
  const otherId = first ? (first.sire === selfId ? first.dam : first.sire) : null;
  const otherH = roster.find((g) => g.inscriptionId === otherId)?.height;
  const otherDna = useQuery({ ...guardianDnaQuery(otherH ?? 0), enabled: otherH != null });
  const baby = useMemo(() => {
    if (!first || !q.data || !otherDna.data || otherH == null || !selfId || !otherId) return null;
    const me: PetParent = { inscriptionId: selfId, height, genome: onchainGenome(q.data) };
    const them: PetParent = { inscriptionId: otherId, height: otherH, genome: onchainGenome(otherDna.data) };
    return first.sire === selfId ? breedPet(me, them) : breedPet(them, me);
  }, [first, q.data, otherDna.data, otherH, selfId, otherId, height]);
  const buildQ = useQuery(forgeBuildQuery(height));
  const [showBuild, setShowBuild] = useState(true);
  const build = buildQ.data ?? null;
  const build3d = useMemo(() => (build && showBuild ? { data: build.data, span: build.span } : null), [build, showBuild]);
  const [trailer, setTrailer] = useState(0);
  const [rec, setRec] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const name = q.data?.blockHash ? onchainGuardianName(height, q.data.blockHash) : `${q.data?.species ?? "GUARDIAN"}`;
  const [recNote, setRecNote] = useState<string | null>(null);
  const [recName, setRecName] = useState("");
  const play = async (record: boolean) => {
    setRec(null); setRecNote(null);
    const gl = canvasRef.current;
    if (!record || !gl) { playTrailerSfx(); setTrailer(performance.now()); return; }
    if (typeof MediaRecorder === "undefined" && !canEncodeMp4()) return setRecNote("THIS BROWSER CAN'T RECORD VIDEO.");
    setRecNote("RECORDING…");
    const [W, H] = X_SIZES["16:9"];
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const ctx = out.getContext("2d")!;
    const audio = await renderTrailerAudio();
    const xr = await createXRecorder(out, audio);
    playTrailerSfx();
    const start = performance.now();
    setTrailer(start);
    const paint = async () => {
      const t = (performance.now() - start) / 1000;
      const s = Math.max(W / gl.width, H / gl.height), dw = gl.width * s, dh = gl.height * s;
      ctx.fillStyle = "#0a0e14"; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(gl, (W - dw) / 2, (H - dh) / 2, dw, dh);
      drawTrailerCaptions(ctx, W, H, Math.min(t, TRAILER_S - 0.01), height, name);
      xr.addFrame(out, Math.min(t, TRAILER_S));
      if (t < TRAILER_S) { requestAnimationFrame(() => void paint()); return; }
      try {
        const blob = await xr.finish();
        const fname = `${height}-guardian-trailer.${xr.kind}`;
        const url = URL.createObjectURL(blob);
        setRec(url); setRecName(fname);
        const a = document.createElement("a"); a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); a.remove();
        setRecNote(xr.kind === "mp4" ? `X-READY MP4 SAVED (1280×720, H.264${xr.hasAudio ? " + AAC" : ""}).` : "SAVED AS WEBM — X NEEDS MP4. USE CHROME, EDGE OR SAFARI.");
      } catch { setRecNote("RECORDING FAILED. TRY AGAIN."); }
    };
    requestAnimationFrame(() => void paint());
  };
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="label text-accent">PREVIEW · NOT YET INSCRIBED</p>
      <h1 className="mt-1 font-display text-3xl">Guardian Studio</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        A Three.js version of the master renderer. Shapes and colours come from the same frozen blueprint as inscribed Guardians; only lighting, shadows and camera are new.
      </p>
      <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); const n = parseInt(input, 10); if (n >= 0) setHeight(n); }}>
        <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} className="w-40 rounded border border-border bg-background px-3 py-1.5 font-mono text-sm" aria-label="BITMAP height" />
        <button className="rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary/10">LOAD .BITMAP</button>
        <button type="button" onClick={() => setAnimate((a) => !a)} className="rounded border border-border px-3 py-1.5 font-mono text-xs">{animate ? "PAUSE MOTION" : "PLAY MOTION"}</button>
        <button type="button" disabled={!q.data} onClick={() => play(false)} className="rounded border border-primary bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground disabled:opacity-40">▶ PLAY MINT TRAILER</button>
        <button type="button" disabled={!q.data} onClick={() => play(true)} className="rounded border border-accent px-3 py-1.5 font-mono text-xs text-accent disabled:opacity-40">● RECORD {TRAILER_S}s CLIP</button>
        {rec && <a href={rec} download={recName} className="rounded border border-accent px-3 py-1.5 font-mono text-xs text-accent">DOWNLOAD CLIP</a>}
        {rec && <a href={`https://x.com/intent/post?text=${encodeURIComponent(`${height}.BITMAP Guardian summoned 🟧 #Bitmap #Ordinals #Bitcoin`)}&url=${encodeURIComponent("https://bitmapwin.app/mint")}`} target="_blank" rel="noreferrer" className="rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary">POST TO X</a>}
        {recNote && <span className="font-mono text-[10px] text-accent">{recNote}</span>}
      </form>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-card">
          {trailer > 0 && q.data && <MintTrailerOverlay start={trailer} height={height} name={name} />}
          {q.data ? <GuardianStudio3D dna={q.data} animate={animate} trailerStart={trailer} parcels={parcels} owners={owners} baby={baby} build={build3d} onCanvas={(c) => { canvasRef.current = c; }} /> : <p className="grid h-full place-items-center font-mono text-xs text-muted-foreground">{q.isError ? "Could not read this block." : "READING BLOCK…"}</p>}
        </div>
        <div className="space-y-2">
          <p className="label text-muted-foreground">CURRENT 2D RENDERER</p>
          {q.data && <GuardianPortrait height={height} dna={q.data} size={200} />}
          <p className="font-mono text-[10px] text-muted-foreground">Orange parcels: unclaimed. {ownerCount > 0 ? `${ownerCount} owner${ownerCount > 1 ? "s" : ""} shown in their own colour.` : "No owned parcels found."}</p>
          <div className="rounded border border-border p-2 font-mono text-[10px]">
            <p className="label text-muted-foreground">BABIES · CHILD INSCRIPTIONS</p>
            {!selfId ? <p className="text-muted-foreground">Not inscribed yet, so it can't have on-chain babies.</p>
              : babiesQ.isLoading ? <p className="text-muted-foreground">Reading chain…</p>
              : babiesQ.isError ? <p className="text-destructive">Could not reach ordinals.com.</p>
              : babies.length === 0 ? <p className="text-muted-foreground">No babies inscribed as children of this Guardian.</p>
              : <>
                  <p className="text-signal">{babies.length} verified bab{babies.length > 1 ? "ies" : "y"}{baby ? " · first shown beside parent" : ""}</p>
                  {babies.map((b) => <Link key={b.id} to="/pet/$id" params={{ id: b.id }} className="block text-primary hover:underline">{b.id.slice(0, 8)}…{b.id.slice(-4)} · GEN {b.g ?? "?"}</Link>)}
                </>}
          </div>
          <div className="rounded border border-border p-2 font-mono text-[10px]">
            <p className="label text-muted-foreground">VOXEL BUILD · ON-CHAIN</p>
            {buildQ.isLoading ? <p className="text-muted-foreground">Reading chain…</p>
              : buildQ.isError ? <p className="text-destructive">Could not reach ordinals.com.</p>
              : !build ? <>
                  <p className="text-muted-foreground">No voxel build inscribed on this BITMAP yet.</p>
                  <Link to="/forge" search={{ height } as never} className="text-primary hover:underline">Build one in Land Forge →</Link>
                </>
              : <>
                  <p className="text-signal">◆ Inscribed · {build.blockCount.toLocaleString()} blocks{build.archetype ? ` · ${build.archetype}` : ""}</p>
                  <a href={`https://ordinals.com/inscription/${build.inscriptionId}`} target="_blank" rel="noreferrer" className="block text-primary hover:underline">{build.inscriptionId.slice(0, 8)}…{build.inscriptionId.slice(-4)}</a>
                  <button type="button" onClick={() => setShowBuild((s) => !s)} className="mt-1 rounded border border-border px-2 py-0.5">{showBuild ? "HIDE IN 3D" : "SHOW IN 3D"}</button>
                </>}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">Drag to orbit · scroll or pinch to zoom.</p>
        </div>
      </div>
    </main>
  );
}
