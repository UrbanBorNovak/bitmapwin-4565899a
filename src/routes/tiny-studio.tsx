import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getBitmapHolderFn } from "@/lib/locate-bitmap.functions";
import { buildTinyStudioHtml } from "@/lib/tiny-studio";
import { brotliPackFn } from "@/lib/brotli-pack.functions";
import { supabase } from "@/integrations/supabase/client";
import { fetchBlockDnaSource, guardianFromBlock } from "@/lib/bitmon";
import { bakeGuardian } from "@/lib/forge-guardian-bake";

/** The BITMAP's awakened Guardian, baked to voxels — only when one exists in the Guardian registry. */
async function guardianFor(h: number): Promise<string | null> {
  const { data } = await supabase.from("bitmon_guardians").select("block_height").eq("block_height", h).maybeSingle();
  return data ? bakeGuardian(guardianFromBlock(await fetchBlockDnaSource(h))) : null;
}

export const Route = createFileRoute("/tiny-studio")({
  head: () => {
    const title = "Tiny Studio — inscribable 3D voxel builder · BitmapWin";
    const description = "A one-file 3D voxel viewer and builder for any BITMAP. Build, export BWVX, and inscribe the studio itself on Bitcoin for a few thousand sats.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: TinyStudio,
});

function save(data: BlobPart, name: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
}

function TinyStudio() {
  const [height, setHeight] = useState(840000);
  const [packed, setPacked] = useState<{ raw: number; size: number; bytes: Uint8Array; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bitmapId, setBitmapId] = useState<{ h: number; id: string } | null>(null);
  const [guardian, setGuardian] = useState<{ h: number; g: string } | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  // The preview frame only trusts replies from this page's own origin.
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.origin), []);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      getBitmapHolderFn({ data: { height } }).then((r) => { if (live && r?.inscriptionId) setBitmapId({ h: height, id: r.inscriptionId }); }).catch(() => {});
      guardianFor(height).then((g) => { if (live && g) setGuardian({ h: height, g }); }).catch(() => {});
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [height]);
  // Answers block lookups from the input inside the preview frame (it can't run the on-chain module here).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // Only our own sandboxed preview frame may ask; any other window is ignored.
      const own = frame.current?.contentWindow;
      if (!own || e.source !== own) return;
      const h = e.data?.tsAsk;
      if (typeof h !== "number" || !Number.isInteger(h) || h < 0 || h > 10_000_000) return;
      const src = own;
      Promise.all([getBitmapHolderFn({ data: { height: h } }), guardianFor(h).catch(() => null)])
        .then(([r, g]) => src.postMessage({ tsH: h, tsId: r?.inscriptionId ?? null, tsG: g }, "*"))
        .catch(() => src.postMessage({ tsH: h, tsId: null }, "*"));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  // The preview frame can't run the on-chain lookup module, so it gets the BITMAP id resolved here; the downloaded file never needs it.
  const previewHtml = useMemo(() => buildTinyStudioHtml({ height, bitmapId: bitmapId?.h === height ? bitmapId.id : undefined, guardian: guardian?.h === height ? guardian.g : undefined, host: host || undefined }), [height, bitmapId, guardian, host]);
  const html = useMemo(() => buildTinyStudioHtml({ height }), [height]);
  const ready = packed && packed.h === height ? packed : null;

  async function pack() {
    setBusy(true);
    try {
      const r = await brotliPackFn({ data: { text: html } });
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      setPacked({ raw: r.rawBytes, size: r.packedBytes, bytes, h: height });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-muted-foreground">CREATION · TINY STUDIO</p>
        <h1 className="font-display text-3xl text-primary">Tiny Studio</h1>
        <p className="max-w-2xl text-muted-foreground">
          A whole 3D voxel builder in one small file. Pick a block, shape it, and save your build — or put the studio itself on Bitcoin so anyone can open it forever.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <iframe ref={frame} title="Tiny Studio" srcDoc={previewHtml} sandbox="allow-scripts allow-downloads" className="h-[560px] w-full rounded-lg border border-border bg-background" />
        <aside className="space-y-4 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs">
          <label className="block space-y-1">
            <span className="text-muted-foreground">STARTING BLOCK</span>
            <input type="number" min={0} value={height} onChange={(e) => setHeight(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded border border-border bg-background px-2 py-1" />
          </label>
          <button onClick={() => save(html, "tiny-studio.html", "text/html")} className="w-full rounded border border-primary px-3 py-2 text-primary hover:bg-primary/10">DOWNLOAD STUDIO (.HTML)</button>
          {ready ? (
            <>
              <button onClick={() => save(ready.bytes as BlobPart, "tiny-studio.html.br", "application/octet-stream")} className="w-full rounded border border-accent px-3 py-2 text-accent hover:bg-accent/10">DOWNLOAD FOR INSCRIPTION · {ready.size.toLocaleString("en-US")} BYTES</button>
              <p className="text-muted-foreground">PACKED {ready.raw.toLocaleString("en-US")} → {ready.size.toLocaleString("en-US")} BYTES · CHECKED: UNPACKS TO THE EXACT SAME FILE</p>
            </>
          ) : (
            <button disabled={busy} onClick={pack} className="w-full rounded border border-border px-3 py-2 hover:bg-muted disabled:opacity-50">{busy ? "PACKING…" : "PREPARE FOR INSCRIPTION (.HTML.BR)"}</button>
          )}
          <div className="space-y-2 border-t border-border pt-3 text-muted-foreground">
            <p className="text-foreground">HOW TO USE</p>
            <p>VIEW switches between ORBIT (drag to turn, scroll or pinch to zoom) and WALK (W A S D to move, Shift to run, drag to look; on a phone, drag in the left circle to move).</p>
            <p>LOOK, PLACE and ERASE decide what a click or tap does — LOOK never changes anything. Keys 1, 2, 3 pick them, V switches the view..</p>
            <p>EXPORT .BWVX saves just your blocks (4 bytes each) in the same format Land Forge uses. SAVE .HTML saves a copy of the studio with your build inside — open it and your build is there.</p>
            <p className="text-foreground">PUT IT ON BITCOIN</p>
            <p>ord wallet inscribe --fee-rate &lt;sats/vB&gt; --file tiny-studio.html --compress. You sign and send it yourself — BitmapWin never does. It needs no website to work: everything is inside the file.</p>
            <p>LOAD: type a block number or an inscription id (Enter works too). You get starter ground right away, replaced by the inscribed build if one exists. Once the studio is on Bitcoin, it finds that BITMAP's newest Land Forge or Tiny Studio build straight from the chain so you can walk it, erase and add blocks, and save your remix. It also runs here in the preview: change STARTING BLOCK and it loads that BITMAP's inscribed build if one exists.</p>
            <p>GUARDIAN: if the BITMAP has an awakened Guardian, it stands on the lowest open ground of the land. It is only shown — it is never saved into your .BWVX or .HTML. On Bitcoin, the studio shows it when the build itself carries a Guardian (Land Forge assemblies with a baked Guardian).</p>
            <p>Anyone can remix any build on their own screen; only the holder of that BITMAP can make a change permanent on Bitcoin. To place a build with its exact parcel limits, use Land Forge.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
