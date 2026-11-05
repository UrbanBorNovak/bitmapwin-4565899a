import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DataBadge } from "@/components/extenders/DataBadge";
import { useEffect, useMemo, useState } from "react";
import { DELEGATE_CONTENT_TYPE, GUARDIAN_MASTER_DELEGATE_ID, TRIBUTE_ADDRESS, TRIBUTE_SATS, guardianMasterGeneratorHtml } from "@/lib/guardian-delegate";
import { brotliMasterGenerator } from "@/lib/brotli.functions";
import { LIVE_OCI_MODULE_ID, V7_CONNECTOME_ID, V7_TRIBUTE_ADDRESS, guardianMasterGeneratorHtmlV7 } from "@/lib/guardian-delegate-v7";
import { guardianMasterGeneratorHtmlV8 } from "@/lib/guardian-delegate-v8";
import { guardianMasterGeneratorHtmlV8Three, guardianV8ThreeByteSize } from "@/lib/guardian-delegate-v8-three";
import { collectionParentStatusFn } from "@/lib/ord-parents.functions";


export const Route = createFileRoute("/dev-tools")({
  head: () => {
    const title = "Developer Tools — BitmapWin";
    const description =
      "Everything you need to build on Bitcoin land: SDK playground, extender studio, AI package builder, MCP endpoint and the public API.";
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
  component: DevToolsPage,
});

const TOOLS = [
  {
    to: "/sdk-playground" as const,
    title: "SDK PLAYGROUND",
    kind: "live" as const,
    note: "SANDBOXED RUNTIME",
    body: "Write extender code and run it immediately in the isolated worker runtime, with live errors and world output.",
  },
  {
    to: "/studio" as const,
    title: "EXTENDER STUDIO",
    kind: "live" as const,
    note: "CODE WORKBENCH",
    body: "Full build surface: edit a package, preview it in the sandbox, publish a version and deploy it to land.",
  },
  {
    to: "/create" as const,
    title: "AI PACKAGE BUILDER",
    kind: "live" as const,
    note: "GEMINI",
    body: "Describe a world in plain language. The builder plans it, writes real SDK code, previews it live and deploys it.",
  },
  {
    to: "/api" as const,
    title: "PUBLIC API",
    kind: "live" as const,
    note: "NO KEY",
    body: "HTTP endpoints for block metadata, offers, registry resolution and the on-chain trade crawler.",
  },
  {
    to: "/bot" as const,
    title: "MARKET BOT",
    kind: "live" as const,
    note: "LISTING ALERTS",
    body: "Set a rule and get alerted when a matching BITMAP lists. Export it to the open-source bot starter for 24/7 alerts.",
  },
  {
    to: "/registry" as const,
    title: "MODEL REGISTRY",
    kind: "live" as const,
    note: "ON-CHAIN GLB",
    body: "Validated 3D model inscriptions placed on bitmaps. The AI builder may only place models registered here.",
  },
  {
    to: "/sdk" as const,
    title: "SDK CONTRACT",
    kind: "live" as const,
    note: "MACHINE READABLE",
    body: "The primitive-by-primitive contract humans and AI agents build against, with runtime limits and permissions.",
  },
];

function DevToolsPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">DEVELOP · TOOLS</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">DEVELOPER TOOLS</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        BitmapWin is the bedrock: land, persistence, ownership, runtime, extensibility, discovery and market.
        These are the tools you build with — for humans and for AI agents.
      </p>

      <div className="mt-8 grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className="bg-background p-6 hover:bg-secondary">
            <DataBadge kind={t.kind} note={t.note} />
            <div className="display mt-4 text-lg">{t.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
          </Link>
        ))}
      </div>

      <CollectionParentPanel />
      <V8ComparePanel />
      <BeaconTestbench />
      <MasterGeneratorPanel version="v7" />
      <MasterGeneratorPanel version="v6" />

      <section className="mt-8 border border-border p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="display text-xl">MCP ENDPOINT</h2>
          <DataBadge kind="live" note="AGENT ACCESS" />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Point an MCP-capable agent at the endpoint below to read bitmap land, extenders and market state
          directly, so an AI can plan and build without scraping the site.
        </p>
        <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">
{`https://bitmapwin.app/mcp`}
        </pre>
      </section>
    </div>
  );
}

/** Setup state of the master collection parent every creature is inscribed under. */
function CollectionParentPanel() {
  const status = useServerFn(collectionParentStatusFn);
  const q = useQuery({ queryKey: ["collection-parent", "status"], queryFn: () => status(), staleTime: 60_000 });
  const d = q.data;
  return (
    <section className="mt-8 border border-border p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-xl">COLLECTION PARENT</h2>
        <DataBadge kind={d?.ready ? "live" : "soon"} note={d?.ready ? "CLAIMED ON EVERY MINT" : "SETUP NEEDED"} />
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Every creature is inscribed as a child of two parents: the bitmap it patrols, and one master collection
        inscription held by BitmapWin. Both parents are spent in the same transaction and returned to their
        holders untouched, which is what groups the whole collection together on explorers.
      </p>
      <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">
{`COLLECTION ADDRESS   ${d?.address || "—"}
MASTER INSCRIPTION   ${d?.masterInscriptionId ?? "NOT SET"}
STATUS               ${d?.ready ? "READY" : d?.reason ?? (q.isLoading ? "CHECKING…" : "UNKNOWN")}`}
      </pre>
      {!d?.ready ? (
        <p className="mt-3 max-w-3xl font-mono text-xs text-bitcoin">
          UNTIL THE MASTER INSCRIPTION SITS ON THAT ADDRESS, CREATURES ARE STILL INSCRIBED AS CHILDREN OF THEIR BITMAP —
          ONLY THE COLLECTION PARENT IS SKIPPED.
        </p>
      ) : null}
    </section>
  );
}



/** Draft V8 beside active V7 — preview only, nothing is inscribed from here. */
function V8ComparePanel() {
  const v7 = useMemo(() => guardianMasterGeneratorHtmlV7(), []);
  const v8 = useMemo(() => guardianMasterGeneratorHtmlV8(), []);
  const size = (s: string) => new TextEncoder().encode(s).length;
  const download = () => {
    const url = URL.createObjectURL(new Blob([v8], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "guardian-master-v8-draft.html";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="mt-8 border border-border p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-xl">V7 vs V8 DRAFT · SIDE BY SIDE</h2>
        <DataBadge kind="soon" note="V8 NOT INSCRIBED · V7 STAYS ACTIVE" />
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        V8 adds the Land Forge build under the Guardian. Outside an ordinals explorer both show the stone relic, so the
        build only appears when the page can read its BITMAP parent on chain.
      </p>
      <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">
{`V7   ${size(v7).toLocaleString()} BYTES
V8   ${size(v8).toLocaleString()} BYTES  (+${(size(v8) - size(v7)).toLocaleString()})`}
      </pre>
      <button type="button" className="mt-3 border border-border px-3 py-2 font-mono text-xs hover:border-signal" onClick={download}>DOWNLOAD V8 DRAFT .HTML</button>
      <button type="button" className="ml-2 mt-3 border border-border px-3 py-2 font-mono text-xs hover:border-signal" onClick={() => {
        const url = URL.createObjectURL(new Blob([guardianMasterGeneratorHtmlV8Three()], { type: "text/html" }));
        const a = document.createElement("a"); a.href = url; a.download = "guardian-master-v8-three.html"; a.click(); URL.revokeObjectURL(url);
      }}>DOWNLOAD V8 · THREE.JS ON-CHAIN .HTML ({guardianV8ThreeByteSize().toLocaleString()} BYTES)</button>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[["V7 · ACTIVE", v7], ["V8 · DRAFT", v8]].map(([label, html]) => (
          <div key={label}>
            <div className="label text-signal">{label}</div>
            <iframe title={label} srcDoc={html} sandbox="allow-scripts" className="mt-2 h-80 w-full border border-border bg-background" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** BIP-352 published test-vector address — a public example, nobody's wallet. */
const MOCK_SP =
  "sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgqjuexzk6murw56suy3e0rd2cgqvycxttddwsvgxe2usfpxumr70xc9pkqwv";

/** Test-only fetch stub injected ahead of the V8 page: fakes this Guardian's children. */
function beaconMock(mode: "live" | "none"): string {
  const kids = mode === "live" ? ["mockchild0i0", "mockbeacon0i0"] : ["mockchild0i0"];
  return `<script>(function(){var of=window.fetch.bind(window),K=${JSON.stringify(kids)},SP=${JSON.stringify(MOCK_SP)};
function R(b,ct){return Promise.resolve(new Response(b,{status:200,headers:{"content-type":ct}}))}
window.fetch=function(u){u=String(u);
 if(u.indexOf("/r/children/9d1da99c")===0){var S=[];for(var q=0;q<140;q++)S.push(((q*2654435761)>>>0).toString(16).padStart(8,"0")+"mocksibling"+q+"i0");return R(JSON.stringify({ids:S,more:false,page:0}),"application/json")}
 if(u.indexOf("/r/children/")===0)return R(JSON.stringify({ids:K,more:false,page:0}),"application/json");
 if(u==="/content/mockbeacon0i0")return R("BW-BEACON-1 "+SP,"text/plain");
 if(u==="/content/mockchild0i0")return R("gm","text/plain");
 return of(u)};
var C=navigator.clipboard,cw=C&&C.writeText?C.writeText.bind(C):null;
var w=function(s){parent.postMessage({beaconCopied:String(s)},"*");return cw?cw(s).catch(function(){}):Promise.resolve()};
try{if(C)C.writeText=w;else Object.defineProperty(navigator,"clipboard",{value:{writeText:w}})}catch(_){}})()</script>`;
}

/** Silent Beacon testbench — mocked children only, nothing is read from or written to the chain. */
function BeaconTestbench() {
  const [mode, setMode] = useState<"live" | "none">("live");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState<string | null>(null);
  const html = useMemo(() => {
    const v8 = guardianMasterGeneratorHtmlV8();
    return v8.replace(/<head[^>]*>/i, (m) => m + beaconMock(mode));
  }, [mode]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.data && typeof e.data.beaconCopied === "string") setCopied(e.data.beaconCopied);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  useEffect(() => setCopied(null), [mode]);
  const btn = (on: boolean) =>
    `border px-3 py-2 font-mono text-xs ${on ? "border-signal text-signal" : "border-border hover:border-signal"}`;
  return (
    <section className="mt-8 border border-border p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-xl">SILENT BEACON · TESTBENCH</h2>
        <DataBadge kind="soon" note="MOCK CHILDREN · NOTHING ON CHAIN" />
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Runs the V8 draft with fake children of the Guardian. Tap TRIBUTE + inside the preview. The address is the public
        BIP-352 test example, not anyone's wallet — never send to it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btn(mode === "live")} onClick={() => setMode("live")}>BEACON LIT</button>
        <button type="button" className={btn(mode === "none")} onClick={() => setMode("none")}>NO BEACON</button>
        <span className="w-4" />
        <button type="button" className={btn(device === "desktop")} onClick={() => setDevice("desktop")}>DESKTOP</button>
        <button type="button" className={btn(device === "mobile")} onClick={() => setDevice("mobile")}>MOBILE</button>
      </div>
      <iframe
        key={mode + device}
        title="Silent Beacon preview"
        srcDoc={html}
        sandbox="allow-scripts"
        allow="clipboard-write"
        className="mt-4 max-w-full border border-border bg-background"
        style={device === "desktop" ? { width: 800, height: 450 } : { width: 360, height: 640 }}
      />
      <div className="mt-3 font-mono text-xs" aria-live="polite">
        {copied === null ? (
          <span className="text-muted-foreground">COPY RESULT · NOT COPIED YET</span>
        ) : (
          <span className={copied === MOCK_SP ? "text-signal" : "text-destructive"}>
            COPY RESULT · {copied === MOCK_SP ? "MATCHES BEACON" : "MISMATCH"} · {copied.slice(0, 18)}…
          </span>
        )}
      </div>
    </section>
  );
}

/** The single master inscription every tiny Guardian delegate mint renders with. */
function MasterGeneratorPanel({ version }: { version: "v6" | "v7" }) {
  const v7 = version === "v7";
  const html = useMemo(() => (v7 ? guardianMasterGeneratorHtmlV7() : guardianMasterGeneratorHtml()), [v7]);
  const bytes = useMemo(() => new TextEncoder().encode(html).length, [html]);
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `guardian-master-${version}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const [brBusy, setBrBusy] = useState(false);
  const [brInfo, setBrInfo] = useState<string | null>(null);
  const downloadBr = async () => {
    setBrBusy(true);
    try {
      const r = await brotliMasterGenerator({ data: { version } });
      const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bin], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `guardian-master-${version}.html.br`;
      a.click();
      URL.revokeObjectURL(url);
      setBrInfo(`${r.rawBytes.toLocaleString()} → ${r.packedBytes.toLocaleString()} BYTES (${Math.round((1 - r.packedBytes / r.rawBytes) * 100)}% SMALLER)`);
    } catch (e) {
      setBrInfo(`FAILED · ${(e as Error).message}`);
    } finally {
      setBrBusy(false);
    }
  };
  return (
    <section className="mt-8 border border-border p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-xl">GUARDIAN MASTER GENERATOR · {version.toUpperCase()}</h2>
        {v7 ? <DataBadge kind="live" note="ACTIVE · #127,517,786" /> : <DataBadge kind={GUARDIAN_MASTER_DELEGATE_ID ? "live" : "soon"} note={GUARDIAN_MASTER_DELEGATE_ID ? "ACTIVE · DELEGATE MINTS ON" : "NOT INSCRIBED YET"} />}
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Inscribe this page once. After that every Guardian can be minted as an almost empty inscription that points
        here; explorers draw it with this code. The page reads its own bitmap parent and checks the {TRIBUTE_SATS.toLocaleString()}-sat
        tribute in its own reveal transaction. Outside an ordinals explorer it shows the stone relic, which is expected.
      </p>
      <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">
{`SIZE           ${bytes.toLocaleString()} BYTES
CONTENT TYPE   ${DELEGATE_CONTENT_TYPE}
${v7 ? `TRIBUTE        ${TRIBUTE_SATS} SATS → ${V7_TRIBUTE_ADDRESS}
BITMAP CHECK   LIVEOCI ${LIVE_OCI_MODULE_ID.slice(0, 12)}…i0 · EVERY HEIGHT TO THE TIP
BRAIN          FLY CONNECTOME ${V7_CONNECTOME_ID.slice(0, 12)}…i0
VERSION        V7 · LIVEOCI · BLOCK MUTATIONS · CONNECTOME MOTOR · CHILD NAVIGATOR
STATUS         INSCRIBED #127,517,786 · BLOCK 969,894 · ACTIVE MASTER` : `TRIBUTE        ${TRIBUTE_SATS} SATS → ${TRIBUTE_ADDRESS}
MASTER ID      9d1da99caec6afbf69b89bdafdc0a7ab679c6dd67920f7b38d3a3fd116d0e21fi0
VERSION        V6 · HONEST PARENT LABEL · HUD OVERLAP FIX · ALL V5 FEATURES
STATUS         V6 INSCRIBED (9d1da99c…i0) · COLLECTION ROOT · STILL ACCEPTED`}`}
      </pre>
      <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
        <button type="button" className="border border-bitcoin px-3 py-2 text-bitcoin hover:bg-bitcoin hover:text-background"
          onClick={() => { void navigator.clipboard?.writeText(html); setCopied(true); }}>
          {copied ? "✓ COPIED" : "COPY RAW HTML"}
        </button>
        <button type="button" className="border border-border px-3 py-2 hover:border-signal" onClick={download}>DOWNLOAD .HTML</button>
        <button type="button" className="border border-signal px-3 py-2 text-signal hover:bg-signal hover:text-background" onClick={() => void downloadBr()}>
          {brBusy ? "COMPRESSING…" : "DOWNLOAD BROTLI (.HTML.BR)"}
        </button>
      </div>
      {brInfo && (
        <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">
{`BROTLI         ${brInfo}
INSCRIBE AS    content-type: ${DELEGATE_CONTENT_TYPE}
               content-encoding: br
TOOL           ord wallet inscribe --compress --file guardian-master-${version}.html
               (or any inscriber that sets the content-encoding br field)
WARNING        never inscribe the .br file without content-encoding: br — it renders as garbage`}
        </pre>
      )}
      <iframe title="Master generator preview" srcDoc={html} sandbox="allow-scripts" className="mt-4 h-80 w-full border border-border bg-background" />
      <div className="mt-6 border border-border p-4 font-mono text-xs">
        <div className="text-signal">LIVEOCI V1.1 AUDIT</div>
        <p className="mt-2 text-muted-foreground">
          BitmapWin reads the on-chain sat cache to block 969,999 with the official corrections, then reads live blocks.
          Open the on-chain dashboard by @boppleton to build an index or compare any external list against the chain.
        </p>
        <a className="mt-3 inline-block border border-signal px-3 py-2 text-signal hover:bg-signal hover:text-background" target="_blank" rel="noreferrer"
          href="https://ordinals.com/content/0c1d5fbd2cf9a2bd33d53d444e4873f9b2efb54f823226f8a76ba0e4baa5cb11i0">OPEN LIVEOCI DASHBOARD ↗</a>
      </div>
    </section>
  );
}
