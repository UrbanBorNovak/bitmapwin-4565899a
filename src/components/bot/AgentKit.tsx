import { useState } from "react";

// Xverse Agent Wallet + bitmapwin MCP kit. Everything here runs on the user's own
// machine; bitmapwin never sees keys and the exported agent never signs or buys.
const SITE = "https://bitmapwin.app";

export const MCP_CONFIG = JSON.stringify(
  { mcpServers: { bitmapwin: { type: "http", url: `${SITE}/mcp` } } },
  null,
  2,
);

const INSTALL = "npx @secretkeylabs/xverse-agent-wallet --install";

// The only wallet command the exported agent may run. Read-only.
export const AGENT_WALLET_ARGS = ["bitcoin", "balance", "--json"] as const;

export function agentScript(maxSats: number, maxHeight: number) {
  return `// bitmap-xverse-agent.ts — run with: bun bitmap-xverse-agent.ts
// Watches open BITMAP listings on bitmapwin and reads your local Xverse Agent Wallet
// balance. It ONLY reports matches — it never signs, buys or broadcasts.
// The single wallet command it runs is: xverse-wallet ${AGENT_WALLET_ARGS.join(" ")}
// Buy matches yourself at ${SITE}/marketplace.
import { execFileSync } from "node:child_process";

const MAX_SATS = ${Math.max(0, Math.floor(maxSats))};
const MAX_HEIGHT = ${Math.max(0, Math.floor(maxHeight))};
// --listings-only: never runs xverse-wallet at all. No wallet needed.
const LISTINGS_ONLY = process.argv.includes("--listings-only");
const seen = new Set<string>();
let warned = false;
if (LISTINGS_ONLY) console.log("[mode] listings-only: Xverse is never called");

// Spendable (native segwit, confirmed) balance in sats, or null if the wallet
// is missing or locked (set XVERSE_PASSWORD in this terminal to unlock reads).
function balanceSats(): number | null {
  if (LISTINGS_ONLY) return null;
  try {
    const raw = execFileSync("xverse-wallet", ${JSON.stringify(AGENT_WALLET_ARGS)}, {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000,
    });
    const sats = Number(JSON.parse(raw)?.native?.confirmed);
    return Number.isFinite(sats) ? sats : null;
  } catch (e: any) {
    if (!warned) {
      warned = true;
      const msg = String(e?.stderr || e?.stdout || e?.message || e).trim().split("\\n")[0];
      console.error("[wallet] balance unknown: " + msg);
    }
    return null;
  }
}

async function tick() {
  try {
    const res = await fetch("${SITE}/api/public/market/listings?sort=recent");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const body = await res.json();
    const rows: any[] = Array.isArray(body?.listings) ? body.listings : [];
    const fresh = rows.filter((l) => !seen.has(l.id));
    fresh.forEach((l) => seen.add(l.id));
    const hits = fresh.filter((l) => l.price_sats <= MAX_SATS && l.bitmap_height <= MAX_HEIGHT);
    const bal = hits.length && !LISTINGS_ONLY ? balanceSats() : null;
    console.log(\`[\${new Date().toISOString()}] checked \${rows.length} listings, \${hits.length} new matches\`);
    for (const l of hits) {
      const afford = LISTINGS_ONLY ? "listings-only" : bal == null ? "balance unknown" : bal >= l.price_sats ? "affordable" : "not enough in wallet";
      console.log(JSON.stringify({ match: \`\${l.bitmap_height}.bitmap\`, price_sats: l.price_sats, afford, open: "${SITE}/map/" + l.bitmap_height }));
    }
  } catch (e: any) {
    console.error("[network] " + (e?.message ?? e) + " — retrying in 30s");
  }
}

await tick();
setInterval(tick, 30_000);
`;
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="label border border-border px-3 py-2 text-signal hover:border-signal"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "COPIED" : label}
    </button>
  );
}

export function AgentKit({ maxSats = 1_000_000, maxHeight = 840_000, showExport = false }: { maxSats?: number; maxHeight?: number; showExport?: boolean }) {
  const download = () => {
    const blob = new Blob([agentScript(maxSats, maxHeight)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bitmap-xverse-agent.ts";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="label text-bitcoin">AI AGENT KIT · XVERSE + BITMAPWIN</span>
        <span className="label text-signal">YOUR KEYS STAY ON YOUR MACHINE</span>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-3">
        <div className="space-y-2">
          <p className="label text-muted-foreground">1 · GIVE YOUR AGENT A WALLET</p>
          <code className="block break-all border border-border p-2 font-mono text-xs" data-no-translate>{INSTALL}</code>
          <div className="flex flex-wrap gap-2">
            <Copy text={INSTALL} label="COPY COMMAND" />
            <a className="label border border-border px-3 py-2 hover:border-signal" href="https://www.xverse.app/agents" target="_blank" rel="noreferrer">XVERSE DOCS ↗</a>
          </div>
        </div>
        <div className="space-y-2">
          <p className="label text-muted-foreground">2 · GIVE IT BITMAP KNOWLEDGE</p>
          <pre className="overflow-x-auto border border-border p-2 font-mono text-xs" data-no-translate>{MCP_CONFIG}</pre>
          <Copy text={MCP_CONFIG} label="COPY MCP CONFIG" />
        </div>
        <div className="space-y-2">
          <p className="label text-muted-foreground">3 · ASK IT</p>
          <p className="text-sm text-muted-foreground">
            Paste the config into Claude, Cursor or another agent. It can search BITMAPs, read activity and builds, and check your Xverse balance.
          </p>
          {showExport && (
            <button type="button" onClick={download} className="label border border-bitcoin px-3 py-2 text-bitcoin">
              DOWNLOAD WATCH AGENT
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <span className="label text-muted-foreground">WORKS WITH</span>
        {["Claude", "Cursor", "Codex", "Copilot", "Cline", "Windsurf"].map((n) => (
          <span key={n} className="border border-border px-2 py-1 font-mono text-[11px] text-foreground" data-no-translate>{n}</span>
        ))}
        <span className="label text-muted-foreground">· ANY MCP CLIENT WITH REMOTE HTTP SERVERS</span>
      </div>
      {showExport && <SetupGuide />}
      <p className="label border-t border-border px-4 py-2 text-muted-foreground">
        The downloaded agent only reports matching listings. It never signs, buys or broadcasts — you buy in your own wallet.
      </p>
    </section>
  );
}

const GUIDE: { title: string; steps: string[]; code?: string[] }[] = [
  { title: "1 · PREREQUISITES", steps: ["A computer with a terminal. Commands below are for macOS and Linux; on Windows, use WSL.", "Node.js 18 or newer, plus Bun to run the agent file."],
    code: ["node --version", "curl -fsSL https://bun.sh/install | bash"] },
  { title: "2 · SET UP THE XVERSE WALLET", steps: [
    "Install the Xverse Agent Wallet on your own computer (tested with version 1.0.1).",
    "Create a wallet in your terminal only. It asks you to choose a password. Write the recovery words on paper.",
    "Use a separate wallet with a small balance just for watching.",
    "The balance check only works when the wallet is unlocked: type your password into this terminal (it stays hidden) before starting the agent."],
    code: [INSTALL, "xverse-wallet wallet create", "read -s XVERSE_PASSWORD && export XVERSE_PASSWORD", "xverse-wallet bitcoin balance --json"] },
  { title: "3 · RUN THE WATCH AGENT", steps: ["Set your rule above, then press Download watch agent.", "In the same terminal, go to the folder with the file and start it.", "Every 30 seconds it prints how many listings it checked, any new matches, and whether your spendable balance covers them. Press Ctrl+C to stop."],
    code: ["bun bitmap-xverse-agent.ts"] },
  { title: "NO WALLET? LISTINGS-ONLY MODE", steps: ["Skip step 2 entirely: you only need Bun.", "Add --listings-only and the agent never calls Xverse, so no wallet is created, unlocked or read.", "Matches are printed the same way, marked \"listings-only\" instead of a balance check."],
    code: ["bun bitmap-xverse-agent.ts --listings-only"] },
  { title: "4 · TROUBLESHOOTING", steps: [
    "\"Vault not initialised\": no wallet yet. Run xverse-wallet wallet create.",
    "\"Vault is locked\": the password isn't set in this terminal. Run the read -s line again, then restart the agent.",
    "\"xverse-wallet: not found\": the install didn't finish. Run the install command again, then open a new terminal.",
    "\"0 new matches\" every time: nothing listed matches your rule yet. Raise the max price or the block range and download again.",
    "\"bun: command not found\": open a new terminal after installing Bun.",
    "\"[network]\" lines: check your connection. The agent tries again on the next 30-second check."] },
];

function SetupGuide() {
  return (
    <div className="border-t border-border p-5">
      <p className="label text-bitcoin">LOCAL SETUP GUIDE</p>
      <div className="mt-3 border border-bitcoin p-3 text-sm">
        <strong className="text-bitcoin">Safety:</strong> the watch agent never signs, buys or broadcasts anything. Never type your recovery words or private keys on this site or any website. They belong only in the Xverse wallet on your own computer.
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {GUIDE.map((g) => (
          <div key={g.title} className="space-y-2 border border-border p-3">
            <p className="label text-signal">{g.title}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {g.steps.map((s) => <li key={s}>{s}</li>)}
            </ul>
            {g.code?.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <code className="block flex-1 break-all border border-border p-2 font-mono text-xs" data-no-translate>{c}</code>
                <Copy text={c} label="COPY" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
