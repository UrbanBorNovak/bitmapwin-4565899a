import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

const BlockRun = lazy(() => import("@/components/arcade/BlockRun"));

export const Route = createFileRoute("/arcade")({
  validateSearch: (search: Record<string, unknown>): { height?: number } => {
    const height = Number(search["height"]);
    return Number.isInteger(height) && height >= 0 && height < 1_000_000 ? { height } : {};
  },
  head: () => {
    const title = "BLOCK RUN — Multiplayer Bitmap Platformer";
    const description =
      "Run the same course together: every Bitcoin block builds its own platformer level, and everyone on that block sees each other move live.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ArcadePage,
});

function ArcadePage() {
  const search = Route.useSearch();
  const [height, setHeight] = useState(search.height ?? 715093);
  const [draft, setDraft] = useState(String(search.height ?? 715093));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-6">
      <header className="space-y-1">
        <h1 className="display text-xl">BLOCK RUN</h1>
        <p className="text-sm text-muted-foreground">
          One course per Bitcoin block. Anyone who opens the same block runs the same layout, and
          you all see each other live. Collect the orange coins, reach the cyan banner.
        </p>
      </header>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = Number(draft);
          if (Number.isInteger(next) && next >= 0 && next < 1_000_000) setHeight(next);
        }}
      >
        <label className="label text-muted-foreground" htmlFor="run-block">
          COURSE BLOCK
        </label>
        <input
          id="run-block"
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          className="w-28 border border-border bg-background px-2 py-1 font-mono text-sm"
        />
        <button type="submit" className="label border border-bitcoin px-3 py-1 text-bitcoin hover:bg-bitcoin/10">
          LOAD COURSE
        </button>
        <Link to="/map" className="label border border-border px-3 py-1 text-muted-foreground hover:text-foreground">
          BACK TO THE ATLAS
        </Link>
      </form>

      <ClientOnly
        fallback={
          <div className="grid h-72 place-items-center border border-border font-mono text-xs text-signal">
            LOADING COURSE…
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="grid h-72 place-items-center border border-border font-mono text-xs text-signal">
              LOADING COURSE…
            </div>
          }
        >
          <BlockRun height={height} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
