import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DataBadge } from "@/components/extenders/DataBadge";
import { useMemo, useState } from "react";
import { DELEGATE_CONTENT_TYPE, GUARDIAN_MASTER_DELEGATE_ID, TRIBUTE_ADDRESS, TRIBUTE_SATS, guardianMasterGeneratorHtml } from "@/lib/guardian-delegate";
import { brotliMasterGenerator } from "@/lib/brotli.functions";
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
    to: "/builds" as const,
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
      <MasterGeneratorPanel />

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



/** The single master inscription every tiny Guardian delegate mint renders with. */
function MasterGeneratorPanel() {
  const html = useMemo(() => guardianMasterGeneratorHtml(), []);
  const bytes = useMemo(() => new TextEncoder().encode(html).length, [html]);
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "guardian-master.html";
    a.click();
    URL.revokeObjectURL(url);
  };
  const [brBusy, setBrBusy] = useState(false);
  const [brInfo, setBrInfo] = useState<string | null>(null);
  const downloadBr = async () => {
    setBrBusy(true);
    try {
      const r = await brotliMasterGenerator();
      const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bin], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "guardian-master.html.br";
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
        <h2 className="display text-xl">GUARDIAN MASTER GENERATOR</h2>
        <DataBadge kind={GUARDIAN_MASTER_DELEGATE_ID ? "live" : "soon"} note={GUARDIAN_MASTER_DELEGATE_ID ? "DELEGATE MINTS ON" : "NOT INSCRIBED YET"} />
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Inscribe this page once. After that every Guardian can be minted as an almost empty inscription that points
        here; explorers draw it with this code. The page reads its own bitmap parent and checks the {TRIBUTE_SATS.toLocaleString()}-sat
        tribute in its own reveal transaction. Outside an ordinals explorer it shows the stone relic, which is expected.
      </p>
      <pre className="mt-3 overflow-x-auto bg-secondary p-4 font-mono text-xs">
{`SIZE           ${bytes.toLocaleString()} BYTES
CONTENT TYPE   ${DELEGATE_CONTENT_TYPE}
TRIBUTE        ${TRIBUTE_SATS} SATS → ${TRIBUTE_ADDRESS}
MASTER ID      ${GUARDIAN_MASTER_DELEGATE_ID || "NOT SET — SEND THE INSCRIPTION ID ONCE IT IS MINED"}
VERSION        V6 · HONEST PARENT LABEL · HUD OVERLAP FIX · ALL V5 FEATURES
STATUS         V6 READY TO INSCRIBE · CHAIN STILL RUNS V5 (#127,506,616) · SET MASTER ID AFTER INSCRIBING`}
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
TOOL           ord wallet inscribe --compress --file guardian-master.html
               (or any inscriber that sets the content-encoding br field)
WARNING        never inscribe the .br file without content-encoding: br — it renders as garbage`}
        </pre>
      )}
      <iframe title="Master generator preview" srcDoc={html} sandbox="allow-scripts" className="mt-4 h-80 w-full border border-border bg-background" />
    </section>
  );
}
