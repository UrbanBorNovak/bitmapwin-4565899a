import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { buildTinyStudioHtml } from "@/lib/tiny-studio";
import { brotliPackFn } from "@/lib/brotli-pack.functions";

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
        <iframe title="Tiny Studio" srcDoc={html} sandbox="allow-scripts allow-downloads" className="h-[560px] w-full rounded-lg border border-border bg-background" />
        <aside className="space-y-4 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs">
          <label className="block space-y-1">
            <span className="text-muted-foreground">STARTING BLOCK</span>
            <input type="number" min={0} value={height} onChange={(e) => setHeight(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded border border-border bg-background px-2 py-1" />
          </label>
          <button onClick={() => save(html, "tiny-studio.html", "text/html")} className="w-full rounded border border-primary px-3 py-2 text-primary hover:bg-primary/10">DOWNLOAD STUDIO (.HTML)</button>
          {ready ? (
            <>
              <button onClick={() => save(ready.bytes as BlobPart, "tiny-studio.html.br", "application/octet-stream")} className="w-full rounded border border-accent px-3 py-2 text-accent hover:bg-accent/10">DOWNLOAD FOR INSCRIPTION · {ready.size.toLocaleString()} BYTES</button>
              <p className="text-muted-foreground">PACKED {ready.raw.toLocaleString()} → {ready.size.toLocaleString()} BYTES · CHECKED: UNPACKS TO THE EXACT SAME FILE</p>
            </>
          ) : (
            <button disabled={busy} onClick={pack} className="w-full rounded border border-border px-3 py-2 hover:bg-muted disabled:opacity-50">{busy ? "PACKING…" : "PREPARE FOR INSCRIPTION (.HTML.BR)"}</button>
          )}
          <div className="space-y-2 border-t border-border pt-3 text-muted-foreground">
            <p className="text-foreground">HOW TO USE</p>
            <p>Drag to look around, scroll to zoom. Pick a colour and click to add a block; switch PLACE to ERASE to remove one. SEED rebuilds the starting ground for any block number.</p>
            <p>EXPORT .BWVX saves just your blocks (4 bytes each) in the same format Land Forge uses. SAVE .HTML saves a copy of the studio with your build inside — open it and your build is there.</p>
            <p className="text-foreground">PUT IT ON BITCOIN</p>
            <p>ord wallet inscribe --fee-rate &lt;sats/vB&gt; --file tiny-studio.html --compress. You sign and send it yourself — BitmapWin never does. It needs no website to work: everything is inside the file.</p>
            <p>The starting ground is a simple shape seeded by the block number, not that block's real BITMAP layout. To place a build on your own BITMAP with its exact parcel limits, use Land Forge.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
