import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

/**
 * BITMAP CLIPS — @bitlodo's MIT-licensed 3D video studio (github.com/bitlodo/bitmap-clips),
 * hosted unmodified as a static bundle under /tools/clips and run in a sandboxed frame.
 * Everything (projects, rendering, export) stays in the visitor's browser.
 */
export const Route = createFileRoute("/clips")({
  validateSearch: (s: Record<string, unknown>): { block?: number } => {
    const n = Number(s["block"]);
    return Number.isInteger(n) && n >= 0 ? { block: n } : {};
  },
  head: () => {
    const title = "Bitmap Clips — Turn Any BITMAP Into a 3D Video";
    const description =
      "Animate a BITMAP's parcels in 3D with scenes, text overlays and generative music, then export an MP4 right in your browser. Built by @bitlodo.";
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
  component: ClipsPage,
});

function ClipsPage() {
  const { block } = Route.useSearch();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label text-bitcoin">CREATION · TOOLS</div>
          <h1 className="display mt-2 text-2xl md:text-4xl">BITMAP CLIPS</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Turn a BITMAP into an animated 3D video with scenes, captions and music, then export it. Projects are saved
            only in your browser. Built by{" "}
            <a className="text-signal underline" href="https://x.com/bitlodo" target="_blank" rel="noreferrer">@bitlodo</a>{" "}
            ·{" "}
            <a className="text-signal underline" href="https://github.com/bitlodo/bitmap-clips" target="_blank" rel="noreferrer">source (MIT)</a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {block !== undefined && (
            <>
              <button
                className="btn-term-ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(String(block));
                  setCopied(true);
                }}
              >
                [ {copied ? "COPIED" : `COPY ${block}`} ]
              </button>
              <Link to="/bitmap/$block" params={{ block: String(block) }} className="btn-term-ghost">
                [ BACK TO {block}.BITMAP ]
              </Link>
            </>
          )}
          <a href="/tools/clips/index.html" target="_blank" rel="noreferrer" className="btn-term">[ OPEN FULL SCREEN ]</a>
        </div>
      </div>
      {block !== undefined && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          &gt; TO USE {block}.BITMAP: CLICK THE PROJECT NAME AT THE TOP OF THE STUDIO → NEW PROJECT → ENTER {block}
        </p>
      )}
      <iframe
        title="Bitmap Clips studio"
        src="/tools/clips/index.html"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms allow-modals"
        allow="fullscreen; autoplay"
        className="mt-4 h-[80vh] w-full rounded-lg border border-border bg-background"
      />
    </div>
  );
}
