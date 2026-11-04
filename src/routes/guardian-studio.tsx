import { useRef, useState } from "react";
import { TRAILER_S } from "@/components/bitmon/GuardianStudio3D";
import { MintTrailerOverlay, playTrailerSfx } from "@/components/bitmon/MintTrailerOverlay";
import { onchainGuardianName } from "@/lib/onchain-name";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { GuardianStudio3D } from "@/components/bitmon/GuardianStudio3D";
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
  const [trailer, setTrailer] = useState(0);
  const [rec, setRec] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const name = q.data?.blockHash ? onchainGuardianName(height, q.data.blockHash) : `${q.data?.species ?? "GUARDIAN"}`;
  const play = (record: boolean) => {
    setRec(null);
    const ac = playTrailerSfx();
    setTrailer(performance.now());
    if (!record || !canvasRef.current || typeof MediaRecorder === "undefined") return;
    // Records the 3D canvas plus the trailer sound (captions are the page overlay, not in the file).
    const stream = canvasRef.current.captureStream(30);
    const dest = ac.createMediaStreamDestination(); ac.destination.channelCount; // keep live output too
    try { (ac as AudioContext & { _out?: GainNode }); } catch { /* noop */ }
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => setRec(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));
    mr.start(); setTimeout(() => mr.stop(), TRAILER_S * 1000);
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
        {rec && <a href={rec} download={`${height}-guardian-trailer.webm`} className="rounded border border-accent px-3 py-1.5 font-mono text-xs text-accent">DOWNLOAD CLIP</a>}
      </form>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-card">
          {trailer > 0 && q.data && <MintTrailerOverlay start={trailer} height={height} name={name} />}
          {q.data ? <GuardianStudio3D dna={q.data} animate={animate} trailerStart={trailer} onCanvas={(c) => { canvasRef.current = c; }} /> : <p className="grid h-full place-items-center font-mono text-xs text-muted-foreground">{q.isError ? "Could not read this block." : "READING BLOCK…"}</p>}
        </div>
        <div className="space-y-2">
          <p className="label text-muted-foreground">CURRENT 2D RENDERER</p>
          {q.data && <GuardianPortrait height={height} dna={q.data} size={200} />}
          <p className="font-mono text-[10px] text-muted-foreground">Drag to orbit · scroll or pinch to zoom.</p>
        </div>
      </div>
    </main>
  );
}
