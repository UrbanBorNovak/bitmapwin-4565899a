import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Zap, Download, Upload, AlertTriangle } from "lucide-react";
import {
  extractInscriptions,
  type ExtractionResult,
  type ExtractedInscription,
} from "@/lib/ordinal-extractor";

export const Route = createFileRoute("/extractor")({
  head: () => ({
    meta: [
      { title: "Ordinal Extractor — Bitmap Marketplace" },
      {
        name: "description",
        content:
          "Decode Ordinal inscriptions directly from a raw Bitcoin transaction. Paste raw hex, extract envelope fields and content bodies client-side.",
      },
      { property: "og:title", content: "Ordinal Extractor — Bitmap Marketplace" },
      {
        property: "og:description",
        content: "Decode Ordinal inscriptions directly from a raw Bitcoin transaction.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExtractorPage,
});

function isBitmapText(text: string | null): string | null {
  if (!text) return null;
  const m = text.trim().match(/^(\d+)\.bitmap$/);
  return m?.[1] ?? null;
}

function InscriptionCard({ inscription }: { inscription: ExtractedInscription }) {
  const contentType = (inscription.fields["content_type"] as string) || null;
  const bitmapHeight = isBitmapText(inscription.bodyText);

  const bodyUrl =
    inscription.body && contentType
      ? URL.createObjectURL(new Blob([inscription.body.slice().buffer as ArrayBuffer], { type: contentType }))
      : null;

  function download() {
    if (!inscription.body) return;
    const blob = new Blob([inscription.body.slice().buffer as ArrayBuffer], {
      type: contentType || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = inscription.id;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <article className="border border-border bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="label">INSCRIPTION</div>
          <div className="mt-1 break-all font-mono text-sm text-foreground">{inscription.id}</div>
        </div>
        {bitmapHeight && (
          <Link
            to="/bitmap/$block"
            params={{ block: bitmapHeight }}
            className="btn-term shrink-0"
          >
            {bitmapHeight}.BITMAP →
          </Link>
        )}
      </header>

      <div className="grid gap-0 md:grid-cols-2">
        <pre className="max-h-96 overflow-auto border-b border-border p-4 font-mono text-xs leading-relaxed text-muted-foreground md:border-b-0 md:border-r">
          {JSON.stringify(inscription.fields, null, 2)}
        </pre>

        <div className="p-4">
          {inscription.body ? (
            <>
              {contentType?.startsWith("image/") && bodyUrl && (
                <img
                  src={bodyUrl}
                  alt={`Inscription ${inscription.id}`}
                  className="max-h-72 w-full border border-border object-contain"
                />
              )}
              {contentType?.startsWith("text/") && (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all border border-border bg-foreground/5 p-3 font-mono text-xs text-foreground">
                  {inscription.bodyText ?? "Binary / invalid UTF-8"}
                </pre>
              )}
              {!contentType?.startsWith("image/") && !contentType?.startsWith("text/") && (
                <div className="label">BINARY BODY — {inscription.body.length} BYTES</div>
              )}
              <button onClick={download} className="btn-term mt-3 inline-flex items-center gap-2">
                <Download className="size-3.5" /> DOWNLOAD BODY
              </button>
            </>
          ) : (
            <div className="label">NO BODY</div>
          )}
        </div>
      </div>
    </article>
  );
}

function ExtractorPage() {
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(hex: string) {
    setBusy(true);
    setError(null);
    setResult(null);
    setStatus("READING TRANSACTION…");
    try {
      const res = await extractInscriptions(hex);
      setResult(res);
      setStatus(
        `DONE — ${res.inscriptions.length} INSCRIPTION(S) FOUND IN TRANSACTION ${res.txid}`
      );
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRaw(text);
    };
    reader.readAsText(file);
  }

  const bitmaps =
    result?.inscriptions
      .map((i) => ({ id: i.id, height: isBitmapText(i.bodyText) }))
      .filter((x): x is { id: string; height: string } => !!x.height) ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <div className="mb-8 border border-border">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Zap className="size-4" />
          <h1 className="display text-2xl md:text-3xl">ORDINAL EXTRACTOR</h1>
        </div>
        <p className="px-4 py-3 font-mono text-sm text-muted-foreground">
          Decode Ordinal inscriptions directly from a raw Bitcoin transaction. All parsing
          happens locally in your browser — nothing is uploaded. If an inscription body is a
          valid <span className="text-foreground">&lt;height&gt;.bitmap</span> claim, it is
          flagged automatically.
        </p>
      </div>

      <div className="label mb-2">RAW TRANSACTION HEX</div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Paste raw Bitcoin transaction hex here…"
        spellCheck={false}
        className="min-h-[240px] w-full resize-y border border-border bg-background p-4 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => run(raw)}
          disabled={busy || !raw.trim()}
          className="btn-term disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "EXTRACTING…" : "EXTRACT INSCRIPTIONS"}
        </button>
        <button onClick={() => fileRef.current?.click()} className="btn-term inline-flex items-center gap-2">
          <Upload className="size-3.5" /> LOAD .TXT / .HEX
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.hex"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {status && (
        <div className="mt-6 border border-border px-4 py-3 font-mono text-xs text-foreground">
          &gt; {status}
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center gap-2 border border-foreground px-4 py-3 font-mono text-xs text-foreground">
          <AlertTriangle className="size-4" /> ERROR: {error}
        </div>
      )}

      {result && bitmaps.length > 0 && (
        <div className="mt-6 border border-border">
          <div className="border-b border-border px-4 py-2 label">BITMAP CLAIMS DETECTED</div>
          <ul className="divide-y divide-border">
            {bitmaps.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-mono text-sm text-foreground">{b.height}.bitmap</span>
                <span className="break-all font-mono text-xs text-muted-foreground">{b.id}</span>
                <Link to="/bitmap/$block" params={{ block: b.height }} className="btn-term">
                  VIEW PARCEL →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {result?.inscriptions.map((inscription) => (
          <InscriptionCard key={inscription.id} inscription={inscription} />
        ))}
      </div>
    </div>
  );
}
