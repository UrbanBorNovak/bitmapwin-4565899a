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

export function agentScript(maxSats: number, maxHeight: number) {
  return `// bitmap-xverse-agent.ts — run with: bun bitmap-xverse-agent.ts
// Watches open BITMAP listings on bitmapwin and checks your local Xverse Agent Wallet
// balance. It ONLY reports matches — it never signs, buys or broadcasts.
// Buy matches yourself at ${SITE}/marketplace.
import { execSync } from "node:child_process";

const MAX_SATS = ${Math.max(0, Math.floor(maxSats))};
const MAX_HEIGHT = ${Math.max(0, Math.floor(maxHeight))};
const seen = new Set<string>();

function balanceSats(): number | null {
  try {
    const out = JSON.parse(execSync("xverse-wallet bitcoin balance --json", { encoding: "utf8" }));
    const btc = Number(out?.native ?? out?.total ?? 0);
    return Math.round(btc * 1e8);
  } catch { return null; }
}

async function tick() {
  const res = await fetch("${SITE}/api/public/market/listings?sort=recent");
  const body = await res.json();
  const rows: any[] = body.listings ?? body.data ?? body ?? [];
  const bal = balanceSats();
  for (const l of rows) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    if (l.price_sats > MAX_SATS || l.bitmap_height > MAX_HEIGHT) continue;
    const afford = bal == null ? "balance unknown" : bal >= l.price_sats ? "affordable" : "not enough in wallet";
    console.log(JSON.stringify({ match: \`\${l.bitmap_height}.bitmap\`, price_sats: l.price_sats, afford, open: "${SITE}/map/" + l.bitmap_height }));
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
      {showExport && <SetupGuide />}
      <p className="label border-t border-border px-4 py-2 text-muted-foreground">
        The downloaded agent only reports matching listings. It never signs, buys or broadcasts — you buy in your own wallet.
      </p>
    </section>
  );
}
