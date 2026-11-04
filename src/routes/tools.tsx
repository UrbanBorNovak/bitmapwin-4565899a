import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AgentKit } from "@/components/bot/AgentKit";

type Cost = "free" | "onchain";
type Cat = "create" | "media" | "trade" | "data";
type Tool = {
  to: string;
  name: string;
  cost: Cost;
  badge: string;
  cat: Cat;
  hook: string;
  specs: string[];
  next?: { to: string; label: string };
  href?: string;
};

const TOOLS: Tool[] = [
  { to: "/toon", name: "Toon Studio", cost: "free", badge: "FREE · EXPORT FOR X", cat: "media",
    hook: "Turn your Guardians and voxel builds into animated cartoon episodes with dialogue, sound and camera cuts.",
    specs: ["3D scenes on real BITMAPs", "speaker close-ups & transitions", "1280×720 video export", "saved series & casts"],
    next: { to: "/mint", label: "Summon your Guardian" } },
  { to: "/tiny-studio", name: "Tiny Studio", cost: "free", badge: "FREE · DOWNLOAD ONLY", cat: "create",
    hook: "Model voxels in your browser, generate land from block data, walk it and download the build.",
    specs: ["64³ and XL 128³ canvas", "block-derived terrain styles", "BWVX download", "no wallet needed"],
    next: { to: "/forge", label: "Inscribe it in Land Forge" } },
  { to: "/store-kit", name: "Tiny Store Kit", cost: "free", badge: "FREE · ONE FILE", cat: "trade",
    hook: "Design a self-contained shop page with live preview and download it as a single file.",
    specs: ["one-file download", "shareable settings links", "Nostr listings", "wallet checkout in the page"],
    next: { to: "/extend", label: "Put it on your land" } },
  { to: "/co-forge", name: "Co-Forge", cost: "free", badge: "FREE · COLLABORATIVE", cat: "create",
    hook: "Build one assembly together with friends in a shared room, with owner approvals.",
    specs: ["room-code invites", "up to 32 pieces", "owner-only controls", "relay keeps rooms 7 days"],
    next: { to: "/forge", label: "Inscribe the assembly" } },
  { to: "/clips", name: "BITMAP Clips", cost: "free", badge: "FREE · BY @BITLODO", cat: "media",
    hook: "Turn a BITMAP into a short retro 3D video clip.",
    specs: ["original @bitlodo studio", "pixel fonts", "runs in your browser"] },
  { to: "https://bitmap.center", href: "https://bitmap.center", name: "bitmap.center", cost: "free", badge: "COMMUNITY · BY @SIX0BITMAP", cat: "create",
    hook: "The arena, the market and the ghost mint for BITMAPs, built around 114588.bitmap.",
    specs: ["Arena mint battles", "Table of Olympus (114588)", "holder index, chat & ghost mints", "external site"] },
  { to: "/bot", name: "Listing Watch Bot", cost: "free", badge: "FREE · ALERTS", cat: "trade",
    hook: "Watch the market with your own rules and get alerted when a matching BITMAP lists.",
    specs: ["rule presets", "checks every 30s", "JSON export", "never buys or signs"],
    next: { to: "/marketplace", label: "Open the market" } },
  { to: "/traits", name: "Trait Scout", cost: "free", badge: "FREE · CHAIN DATA", cat: "data",
    hook: "Browse official BITMAP traits backed only by proven block facts.",
    specs: ["Bitmap.Community trait definitions", "verified holders", "block history notes"] },
  { to: "/stream", name: "World Stream", cost: "free", badge: "FREE · LIVE", cat: "data",
    hook: "Watch verified BITMAP history play back as a live radar of events.",
    specs: ["100–1,000 event density", "filters & scrubber", "sound cues", "no sign-in"] },
  { to: "/forge", name: "Land Forge", cost: "onchain", badge: "ON-CHAIN · SATS", cat: "create",
    hook: "Build on your BITMAP and inscribe it onto the BITMAP's own sat, paying reused-piece makers in the same transaction.",
    specs: ["4 bytes per block", "maker tributes ≥546 sats", "max 8 tribute outputs", "share a provenance card"] },
  { to: "/mint", name: "Guardian Summon", cost: "onchain", badge: "ON-CHAIN · ONE PER BLOCK", cat: "create",
    hook: "Summon the one Guardian born from your block's DNA.",
    specs: ["one per block", "design derived from block data", "same look everywhere"],
    next: { to: "/toon", label: "Cast it in a cartoon" } },
  { to: "/breed", name: "Breeding Lab", cost: "onchain", badge: "ON-CHAIN · PEDIGREE", cat: "create",
    hook: "Pair two inscribed Guardians and inscribe their pet with both parents on record.",
    specs: ["parents must be inscribed", "anyone can re-check pedigree", "DNA helix reveal"] },
  { to: "/extend", name: "Host & Earn", cost: "onchain", badge: "ON-CHAIN · BIT REWARDS", cat: "create",
    hook: "Put an experience on a BITMAP you hold and share in its daily visitor BIT.",
    specs: ["live holder check", "daily visitor rewards", "no hosting to manage"] },
  { to: "/marketplace", name: "BITMAP Market", cost: "onchain", badge: "ON-CHAIN · BTC", cat: "trade",
    hook: "Buy and sell BITMAPs peer to peer with fair-value price hints.",
    specs: ["90s checkout hold vs snipes", "EV−/EV/EV+ pricing", "BTC / sats / USD", "you sign in your wallet"] },
];

const CATS: { id: "all" | Cat; label: string }[] = [
  { id: "all", label: "ALL" }, { id: "create", label: "BUILD" }, { id: "media", label: "MEDIA" },
  { id: "trade", label: "TRADE" }, { id: "data", label: "DATA" },
];

export const Route = createFileRoute("/tools")({
  head: () => {
    const title = "BITMAP Tools — Free Creator Tools and On-Chain Protocols";
    const description =
      "Every BITMAPWIN tool in one place: free browser studios for voxels, cartoons, shops and alerts, plus on-chain tools to inscribe, summon and trade on Bitcoin.";
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
  component: ToolsPage,
});

function ToolsPage() {
  const [cost, setCost] = useState<"all" | Cost>("all");
  const [cat, setCat] = useState<"all" | Cat>("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return TOOLS.filter((t) =>
      (cost === "all" || t.cost === cost) && (cat === "all" || t.cat === cat) &&
      (!s || [t.name, t.hook, t.badge, ...t.specs].join(" ").toLowerCase().includes(s)));
  }, [cost, cat, q]);
  const free = TOOLS.filter((t) => t.cost === "free").length;
  const chip = (on: boolean) =>
    `border px-3 py-1.5 font-mono text-xs tracking-wider ${on ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:border-signal hover:text-signal"}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="font-mono text-xs tracking-widest text-signal">TOOLS // DIRECTORY</p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">BITMAP tools</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Start free in your browser — no wallet. When you like what you made, take it on-chain.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button className={chip(cost === "all")} onClick={() => setCost("all")}>ALL ({TOOLS.length})</button>
        <button className={chip(cost === "free")} onClick={() => setCost("free")}>FREE ({free})</button>
        <button className={chip(cost === "onchain")} onClick={() => setCost("onchain")}>ON-CHAIN ({TOOLS.length - free})</button>
        <span className="mx-1 w-px bg-border" />
        {CATS.map((c) => (
          <button key={c.id} className={chip(cat === c.id)} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>
      <input
        value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools… e.g. video, voxel, alerts"
        className="mt-3 w-full border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-signal"
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <article key={t.to + t.name} className="flex flex-col border border-border bg-card/60 p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">{t.name}</h2>
              <span className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] tracking-wider ${t.cost === "free" ? "border-signal text-signal" : "border-bitcoin text-bitcoin"}`}>
                {t.badge}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.hook}</p>
            <p className="mt-3 font-mono text-xs text-foreground/80">{t.specs.join(" · ")}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
              {t.href ? (
                <a href={t.href} target="_blank" rel="noopener noreferrer" className="border border-bitcoin px-3 py-1.5 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background">
                  OPEN ↗
                </a>
              ) : (
                <Link to={t.to} className="border border-bitcoin px-3 py-1.5 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background">
                  OPEN →
                </Link>
              )}
              {t.next && (
                <Link to={t.next.to} className="font-mono text-xs text-muted-foreground hover:text-signal">
                  then: {t.next.label} ↗
                </Link>
              )}
            </div>
          </article>
        ))}
        {list.length === 0 && <p className="text-muted-foreground">No tools match that search.</p>}
      </div>
      <div className="mt-8"><AgentKit /></div>
    </main>
  );
}
