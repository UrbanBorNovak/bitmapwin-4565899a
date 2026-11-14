import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bitcoin, Boxes, MapPin, Search, Users } from "lucide-react";
import oasisHero from "@/assets/oasis-hero.jpg";

const PILLARS = [
  { Icon: Bitcoin, t: "BITCOIN NATIVE", b: "1 block = 1 BITMAP" },
  { Icon: MapPin, t: "OWN & TRADE", b: "Ownership read from chain" },
  { Icon: Boxes, t: "BUILD", b: "Voxel builds & worlds" },
  { Icon: Users, t: "COMMUNITY", b: "Made by builders" },
];

type Target =
  | { kind: "block"; height: number }
  | { kind: "address"; address: string }
  | { kind: "inscription"; id: string }
  | null;

export function parseOmnibar(raw: string): Target {
  const q = raw.trim();
  const block = /^(\d{1,7})(\.bitmap)?$/i.exec(q);
  if (block) return { kind: "block", height: Number(block[1]) };
  if (/^[a-f0-9]{64}i\d+$/i.test(q)) return { kind: "inscription", id: q.toLowerCase() };
  if (/^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(q)) return { kind: "address", address: q };
  return null;
}

const TRENDING = [0, 9, 7919, 840000];

export function OmnibarTerminal() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [err, setErr] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|TEXTAREA/.test(t.tagName)) return;
      if (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = () => {
    const t = parseOmnibar(q);
    if (!t) return setErr(true);
    setErr(false);
    if (t.kind === "block") navigate({ to: "/bitmap/$block", params: { block: String(t.height) } });
    else if (t.kind === "address") navigate({ to: "/profile/$address", params: { address: t.address } });
    else window.open(`https://ordinals.com/inscription/${t.id}`, "_blank", "noopener");
  };

  return (
    <section className="mx-auto max-w-[1600px] px-3 pt-3 md:px-5 md:pt-5">
      <div className="relative overflow-hidden border border-border-strong bg-background">
        <img src={oasisHero} alt="" width={1920} height={1088} className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-80" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        <div className="relative max-w-3xl px-5 py-12 md:px-12 md:py-20">
          <h1 className="display text-3xl font-bold leading-[1.02] md:text-5xl">
            Every Bitcoin block <span className="text-bitcoin">is land you can walk,</span> own, and build on.
          </h1>
          <p className="mt-5 max-w-xl text-sm text-muted-foreground md:text-lg">
            BitmapWin turns every block into ownable voxel land in the Oasis. Ownership lives on Bitcoin. The world lives here.
          </p>
          <form
            className="mt-7 flex max-w-2xl flex-col border border-border-strong bg-card/70 backdrop-blur-md focus-within:border-bitcoin sm:flex-row"
            onSubmit={(e) => { e.preventDefault(); if (!q.trim()) { navigate({ to: "/oasis" }); return; } go(); }}
          >
            <div className="flex min-w-0 flex-1 items-center">
              <Search className="ml-4 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={ref}
                value={q}
                onChange={(e) => { setQ(e.target.value); setErr(false); }}
                placeholder="Search block, 840000.bitmap, address or inscription…"
                aria-label="Search BITMAP, wallet or inscription"
                className="min-w-0 flex-1 bg-transparent px-3 py-4 font-mono text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button type="submit" className="flex items-center justify-center gap-2 bg-bitcoin px-6 py-4 text-sm font-bold text-primary-foreground hover:opacity-90">
              {q.trim() ? "Search" : "Enter the Oasis"} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </form>
          {err && <p className="mt-2 font-mono text-xs text-destructive" role="alert">Not a block number, address or inscription id.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span className="label">TRENDING:</span>
            {TRENDING.map((h) => (
              <Link key={h} to="/bitmap/$block" params={{ block: String(h) }} className="hover:text-bitcoin">
                {h.toLocaleString("en-US")}.bitmap
              </Link>
            ))}
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-4">
            {PILLARS.map(({ Icon, t, b }) => (
              <div key={t} className="flex gap-2">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-bitcoin" aria-hidden />
                <div>
                  <div className="font-mono text-[11px] font-bold text-bitcoin">{t}</div>
                  <div className="text-xs text-muted-foreground">{b}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mx-5 mb-5 border border-border-strong bg-card/70 p-4 backdrop-blur-md md:absolute md:bottom-6 md:right-6 md:m-0">
          <div className="flex items-center gap-2 font-mono text-[11px] text-signal"><span className="h-2 w-2 rounded-full bg-signal" />OASIS · NO WALLET NEEDED</div>
          <p className="mt-2 max-w-[16rem] text-xs text-muted-foreground">1 block = 1 BITMAP. You own the sat, you own the land.</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <UtilityCard tag="INSPECT" title="BITMAP EXPLORER" body="Every block's parcels, inscriptions, builds and history." to="/explore" cta="Explore land" />
        <UtilityCard tag="TRACK" title="WALLET LOOKUP" body="Paste any address above to see its BITMAPs. No wallet connect." to="/my-land" cta="My land" />
        <UtilityCard tag="TRADE" title="MARKETPLACE" body="Live floors, PSBT listings and many-for-one barters." to="/marketplace" cta="View market" />
      </div>

      <Link to="/oasis" className="group relative mt-3 block overflow-hidden border border-border-strong bg-card p-6 md:p-10 hover:border-signal">
        <div className="pointer-events-none absolute inset-0 dot-bg opacity-60" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="label text-signal">FEATURED · 3D WORLD</div>
            <h2 className="display mt-2 text-3xl md:text-5xl">THE OASIS</h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">Walk BITMAP districts with community voxel builds. No wallet needed.</p>
          </div>
          <span className="font-mono text-xs font-bold text-bitcoin group-hover:text-foreground">ENTER THE OASIS →</span>
        </div>
      </Link>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <UtilityCard tag="CREATE" title="LIVING SLABS & FORGE" body="3D land grading with sat rarities, plus the voxel build studio." to="/slab" cta="Inspect slabs" />
        <UtilityCard tag="COMMUNITY" title="SOVEREIGN GRANDSTAND" body="Inscribed stands with signed, publicly verifiable seats." to="/stand" cta="Enter grandstand" />
      </div>
    </section>
  );
}

function UtilityCard(p: { tag: string; title: string; body: string; to: "/explore" | "/my-land" | "/marketplace" | "/slab" | "/stand"; cta: string }) {
  return (
    <Link to={p.to} className="group flex flex-col justify-between border border-border bg-card p-5 hover:border-foreground">
      <div>
        <div className="label text-signal">{p.tag}</div>
        <h3 className="display mt-2 text-lg">{p.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
      </div>
      <span className="mt-5 font-mono text-xs font-bold text-bitcoin group-hover:text-foreground">{p.cta.toUpperCase()} →</span>
    </Link>
  );
}
