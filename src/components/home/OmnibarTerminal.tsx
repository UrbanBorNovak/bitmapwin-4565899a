import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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
      <div className="relative overflow-hidden border border-border-strong bg-card px-5 py-10 md:px-10 md:py-14">
        <div className="pointer-events-none absolute inset-0 dot-bg" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="label text-signal">BITCOIN-NATIVE WORLDS</div>
          <h1 className="display mt-3 text-4xl leading-[0.95] md:text-6xl">
            THE OPERATING SYSTEM <span className="text-bitcoin">FOR BLOCKSPACE</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
            Look up any BITMAP, wallet or inscription. Ownership is read from Bitcoin.
          </p>
          <form
            className="mt-7 flex border border-border-strong bg-background focus-within:border-bitcoin"
            onSubmit={(e) => { e.preventDefault(); go(); }}
          >
            <input
              ref={ref}
              value={q}
              onChange={(e) => { setQ(e.target.value); setErr(false); }}
              placeholder="Block #, 840000.bitmap, inscription id or bc1… address"
              aria-label="Search BITMAP, wallet or inscription"
              className="min-w-0 flex-1 bg-transparent px-4 py-4 font-mono text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden self-center px-3 font-mono text-[10px] text-muted-foreground sm:block">/</kbd>
            <button type="submit" className="bg-bitcoin px-5 font-mono text-xs font-bold text-primary-foreground hover:opacity-90">
              SEARCH ↵
            </button>
          </form>
          {err && <p className="mt-2 font-mono text-xs text-destructive" role="alert">Not a block number, address or inscription id.</p>}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span className="label">TRENDING:</span>
            {TRENDING.map((h) => (
              <Link key={h} to="/bitmap/$block" params={{ block: String(h) }} className="hover:text-bitcoin">
                {h.toLocaleString("en-US")}.bitmap
              </Link>
            ))}
            <Link to="/marketplace" className="hover:text-bitcoin">Floors</Link>
          </div>
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
