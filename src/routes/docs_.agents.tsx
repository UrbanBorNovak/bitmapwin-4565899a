import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/docs_/agents")({
  head: () => {
    const title = "Connect Grok & AI Agents to BITMAP — BitmapWin Docs";
    const description =
      "Point Grok or any MCP-capable AI agent at the BitmapWin MCP endpoint: read BITMAPs, parcels, floors and leases, and propose builds that only your wallet can approve.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: AgentsGuide,
});

const ENDPOINT = "https://bitmapwin.app/mcp";
const SCHEMA = "https://bitmapwin.app/api/public/agent-schema";

const CLIENT_CONFIG = `{
  "mcpServers": {
    "bitmap": {
      "url": "${ENDPOINT}"
    }
  }
}`;

const XAI_SNIPPET = `import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["XAI_API_KEY"], base_url="https://api.x.ai/v1")

resp = client.responses.create(
    model="grok-4",
    tools=[{
        "type": "mcp",
        "server_label": "bitmap",
        "server_url": "${ENDPOINT}",
        # Your own BitmapWin access token (see step 2). Never share it.
        "authorization": os.environ["BITMAP_TOKEN"],
    }],
    input="List my BITMAPs, then find open parcels on the oldest one.",
)
print(resp.output_text)`;

const PROMPT = `You are my BITMAP land manager, connected to the BitmapWin MCP server.
1. Call my_bitmaps and pick my oldest BITMAP.
2. Call get_parcel_boundaries and inspect_build for it.
3. Design a small build that stays inside my own parcel rect.
4. Send it with submit_build_proposal as [x, y, z, kind] voxels.
5. Tell me what you proposed. Never claim it is inscribed — I approve it with my wallet.`;

const TOOLS = [
  ["search_bitmaps", "Search the BITMAP registry by height, club or holder.", "READ"],
  ["get_bitmap", "One BITMAP: claim, block stats, build page and live bids.", "READ"],
  ["get_parcel_boundaries", "Parcel tile rights derived from the block (Mondrian rects).", "READ"],
  ["discover_open_parcels", "Unbuilt parcel tiles with live holders.", "READ"],
  ["inspect_build", "What is already built on a BITMAP or parcel.", "READ"],
  ["get_floor_prices", "Cheapest real open listings.", "READ"],
  ["get_lease_status", "Who may build on a BITMAP during a lease.", "READ"],
  ["recent_builds", "What people are building right now.", "READ"],
  ["get_bitmap_activity", "Full event timeline of one BITMAP.", "READ"],
  ["my_bitmaps · my_bids · my_bit_balance", "Your own holdings, bids and BIT.", "YOURS"],
  ["get_portfolio_activity · my_watchlist", "One stream across BITMAPs you own or watch.", "YOURS"],
  ["watch_bitmap", "Add or remove a BITMAP from your watchlist.", "YOURS"],
  ["submit_build_proposal · my_build_proposals", "Save a build suggestion on your own ground and list them.", "PROPOSE"],
] as const;

function Code({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="relative mt-3">
      <pre className="overflow-x-auto border border-border bg-card/60 p-4 font-mono text-xs leading-relaxed text-foreground">{text}</pre>
      <button
        type="button"
        className="btn-term-ghost absolute right-2 top-2 text-[10px]"
        onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
      >
        {done ? "COPIED" : "COPY"}
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-border pt-6">
      <div className="label text-bitcoin">STEP {n}</div>
      <h2 className="display mt-2 text-xl md:text-2xl">{title}</h2>
      <div className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function AgentsGuide() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <Link to="/docs" className="label text-signal hover:underline">← DOCS</Link>
      <div className="label mt-4 text-bitcoin">DEVELOP · AGENTS</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">CONNECT GROK TO BITMAP</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Bring your own Grok bot — or any AI agent that speaks MCP. It reads your BITMAPs, parcels, floors and leases,
        and can suggest builds for your land. You pay for your own AI; BitmapWin never runs it for you.
      </p>
      <div className="mt-6 grid gap-2 font-mono text-xs md:grid-cols-2">
        <div className="border border-border bg-card/40 p-3"><span className="text-muted-foreground">MCP ENDPOINT</span><br /><span className="text-signal">{ENDPOINT}</span></div>
        <div className="border border-border bg-card/40 p-3"><span className="text-muted-foreground">SCHEMAS</span><br /><a href={SCHEMA} className="text-signal hover:underline">{SCHEMA}</a></div>
      </div>

      <Step n="01" title="ADD THE SERVER TO YOUR AGENT">
        <p>Any MCP client with remote-server support takes this config. Clients that handle sign-in themselves will open a BitmapWin login window the first time.</p>
        <Code text={CLIENT_CONFIG} />
      </Step>

      <Step n="02" title="SIGN IN AS YOURSELF">
        <p>
          Every tool acts as the signed-in BitmapWin account, so your agent sees only what you can see. The server uses
          standard OAuth 2.1: an MCP client signs you in and keeps the token. If you call Grok through the xAI API
          directly, you pass that access token yourself — treat it like a password and keep it in an environment variable.
        </p>
      </Step>

      <Step n="03" title="CALL IT FROM GROK (xAI API)">
        <p>xAI's Responses API can attach remote MCP servers as a tool. Example in Python (field names follow xAI's remote MCP docs; check them for the latest models):</p>
        <Code text={XAI_SNIPPET} />
      </Step>

      <Step n="04" title="GIVE IT A JOB">
        <p>A starter prompt that surveys your land and proposes a build:</p>
        <Code text={PROMPT} />
      </Step>

      <section className="mt-10 border-t border-border pt-6">
        <div className="label text-bitcoin">TOOLS</div>
        <h2 className="display mt-2 text-xl md:text-2xl">WHAT YOUR AGENT CAN DO</h2>
        <div className="mt-4 divide-y divide-border border border-border">
          {TOOLS.map(([name, body, kind]) => (
            <div key={name} className="grid gap-1 p-3 md:grid-cols-[1fr_2fr_auto] md:items-center md:gap-4">
              <code className="font-mono text-xs text-signal">{name}</code>
              <span className="text-sm text-muted-foreground">{body}</span>
              <span className={`label text-[10px] ${kind === "PROPOSE" ? "text-bitcoin" : "text-muted-foreground"}`}>{kind}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 border border-bitcoin/40 bg-card/40 p-5">
        <div className="label text-bitcoin">SAFETY RULES</div>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>▸ Agents read and propose. They never sign, pay, inscribe or move sats.</li>
          <li>▸ Build proposals are checked against live ownership and clipped to your own parcel ground.</li>
          <li>▸ A proposal only becomes real when you open it and approve it with your own wallet.</li>
          <li>▸ Your agent cannot see or write to anyone else's account.</li>
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-2">
        <Link to="/sdk" className="btn-term">[ SDK REFERENCE ]</Link>
        <Link to="/api" className="btn-term-ghost">[ PUBLIC API ]</Link>
        <Link to="/forge" className="btn-term-ghost">[ LAND FORGE ]</Link>
      </div>
    </div>
  );
}
