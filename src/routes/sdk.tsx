import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BUILD_KINDS,
  BUILD_KIND_HINTS,
  BUILD_KIND_LABELS,
  BUILD_LIMITS,
  BUILD_PROTOCOL,
  BUILD_PROTOCOL_VERSION,
  BUILD_SDK_VERSION,
  DEFAULT_CONFIGS,
  createBuildPayload,
} from "@/lib/build-sdk";

export const Route = createFileRoute("/sdk")({
  head: () => ({
    meta: [
      { title: "Build SDK — Build On Your Bitmap" },
      {
        name: "description",
        content:
          "The zero-dependency BITMAP BUILD SDK: write info pages, on-chain galleries, 3D worlds and 2D arcades on Bitcoin bitmap land, then inscribe the build JSON.",
      },
      { property: "og:title", content: "BITMAP BUILD SDK" },
      {
        property: "og:description",
        content: "Zero-dependency SDK and wire format for building on <height>.bitmap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SdkPage,
});

const Code = ({ children }: { children: string }) => (
  <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-card px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
    {children}
  </pre>
);

function SdkPage() {
  const example = createBuildPayload({
    height: 840000,
    kind: "gallery",
    owner: "bc1p…",
    title: "HALVING GALLERY",
    config: { columns: 3, items: [{ inscriptionId: "5434ea…369di0", caption: "SODA" }] },
  });

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">BUILD SDK</h1>
      <p className="label mt-3">
        @BITMAP/BUILD-SDK v{BUILD_SDK_VERSION} — PROTOCOL {BUILD_PROTOCOL.toUpperCase()} V
        {BUILD_PROTOCOL_VERSION} · ZERO DEPENDENCIES · MIT
      </p>
      <p className="mt-4 max-w-[75ch] font-mono text-sm text-muted-foreground">
        A build is what a holder puts on top of <span className="text-foreground">&lt;height&gt;.bitmap</span>.
        Every build is <span className="text-foreground">{"{ kind, config }"}</span>. The SDK owns the kinds,
        the typed configs, the sanitiser and the inscribe-ready wire format — the same code this
        marketplace renders, so anything you produce with it renders here too.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a className="btn-term" href="/api/public/build-sdk" target="_blank" rel="noreferrer">
          [ GET SDK SOURCE ]
        </a>
        <Link className="btn-term-ghost" to="/builds">
          [ SEE LIVE BUILDS ]
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="display text-lg">INSTALL</h2>
        <Code>{`bun add @bitmap/build-sdk\n# or vendor it directly:\ncurl -o bitmap-build-sdk.ts https://bitmap.market/api/public/build-sdk`}</Code>
      </section>

      <section className="mt-12">
        <h2 className="display text-lg">BUILD KINDS</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BUILD_KINDS.map((kind) => (
            <div key={kind} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="display text-base">{BUILD_KIND_LABELS[kind]}</span>
                <span className="label text-primary">{kind}</span>
              </div>
              <p className="label mt-2 text-muted-foreground">{BUILD_KIND_HINTS[kind]}</p>
              <pre className="mt-3 overflow-x-auto font-mono text-[11px] text-muted-foreground">
                {JSON.stringify(DEFAULT_CONFIGS[kind], null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="display text-lg">MAKE A BUILD</h2>
        <Code>{`import { createBuildPayload } from "@bitmap/build-sdk";

const payload = createBuildPayload({
  height: 840000,
  kind: "gallery",
  owner: "bc1p…",
  title: "HALVING GALLERY",
  config: { columns: 3, items: [{ inscriptionId: "…i0", caption: "SODA" }] },
});`}</Code>
        <p className="label mt-3">RESULT — INSCRIBE THIS AS A CHILD OF 840000.BITMAP</p>
        <Code>{JSON.stringify(example, null, 2)}</Code>
      </section>

      <section className="mt-12">
        <h2 className="display text-lg">READ A BUILD BACK</h2>
        <Code>{`import { parseBuildPayload, payloadHeight } from "@bitmap/build-sdk";

const build = parseBuildPayload(JSON.parse(text)); // throws on wrong protocol/version
payloadHeight(build); // 840000`}</Code>
      </section>

      <section className="mt-12">
        <h2 className="display text-lg">DETERMINISTIC VISUALS</h2>
        <p className="mt-2 max-w-[75ch] font-mono text-sm text-muted-foreground">
          Generated builds must look identical for every visitor. Seed from the block height.
        </p>
        <Code>{`import { buildSeed, seededRandom } from "@bitmap/build-sdk";

const rand = seededRandom(buildSeed(840000));
const towerHeight = 1 + rand() * 5;`}</Code>
      </section>

      <section className="mt-12">
        <h2 className="display text-lg">LIMITS</h2>
        <Code>{JSON.stringify(BUILD_LIMITS, null, 2)}</Code>
        <p className="label mt-3">
          EVERY VALUE IS CLAMPED BY PARSEBUILDCONFIG — LOOSE INPUT CAN NEVER PRODUCE AN INVALID BUILD
        </p>
      </section>

      <section className="mt-12 rounded-lg border border-border bg-card p-6">
        <h2 className="display text-lg">PROTOCOL RULES</h2>
        <ul className="mt-3 space-y-2 font-mono text-xs text-muted-foreground">
          <li>&gt; A VALID BITMAP IS THE FIRST INSCRIPTION CLAIMING &lt;HEIGHT&gt;.BITMAP</li>
          <li>&gt; A BUILD BELONGS TO THE HOLDER, OR A DELEGATE THE HOLDER GRANTS</li>
          <li>
            &gt; PARCELS ARE CHILD INSCRIPTIONS NAMED &lt;INDEX&gt;.&lt;HEIGHT&gt;.BITMAP, INDEX UP TO
            THE BLOCK TX COUNT
          </li>
        </ul>
      </section>
    </div>
  );
}
