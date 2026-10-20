import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { forgeBuildQuery, forgeLandQuery } from "@/lib/forge";
import { asSpan, decodeBuild, FORGE_SPAN } from "@/lib/voxel-populate";
import { mergeParcelBuilds, parcelRects } from "@/lib/forge-parcels";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { classifyProposal } from "@/lib/proposal-ghost";
const ProposalGhost3D = lazy(() => import("@/components/colony/ProposalGhost3D"));
import { CITIZENS, citizenAt, needsApproval, brokerPicks, recheckListing, type Proposal } from "@/lib/agent-colony";
import { useProposalStore } from "@/lib/agent-proposals-store";
import { fetchOffers } from "@/lib/offers";
import { supabase } from "@/integrations/supabase/client";
import { LANDMARKS, landmarkSpot } from "@/lib/world-landmarks";
import { toast } from "sonner";

export const Route = createFileRoute("/colony")({
  head: () => ({
    meta: [
      { title: "Agent Colony · BitmapWin" },
      { name: "description", content: "Live dashboard of the Oasis agent citizens: where they are, what they're doing, and every trade or spend waiting for owner approval." },
      { property: "og:title", content: "Agent Colony · BitmapWin" },
      { property: "og:description", content: "Where every Oasis citizen is right now, and an owner approval queue for any agent trade or spend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ColonyPage,
});

type BuildRow = { id: string; bitmap_height: number; parcel_index: number | null; role: string; block_count: number; note: string | null; model_inscription_id: string | null; status: string; created_at: string; blocks: [number, number, number, string][] };

/** Top-down preview: highest voxel per column, brighter = taller. */
function BuildTopView({ blocks }: { blocks: [number, number, number, string][] }) {
  const top = new Map<number, number>();
  let max = 1;
  for (const [x, y, z] of blocks) { const k = x * 64 + z; if ((top.get(k) ?? -1) < y) top.set(k, y); if (y > max) max = y; }
  return (
    <svg viewBox="0 0 64 64" className="h-28 w-28 shrink-0 rounded border border-border bg-background" aria-label="Build preview from above">
      {[...top].map(([k, y]) => <rect key={k} x={Math.floor(k / 64)} y={k % 64} width={1} height={1} className="fill-primary" opacity={0.3 + 0.7 * (y / max)} />)}
    </svg>
  );
}

function GhostCompare({ r }: { r: BuildRow }) {
  const [land, setLand] = useState(true);
  const [ghost, setGhost] = useState(true);
  const build = useQuery(forgeBuildQuery(r.bitmap_height));
  const landQ = useQuery(forgeLandQuery(r.bitmap_height));
  const sizes = useQuery(blockSizeMapQuery(r.bitmap_height));
  const ready = !build.isLoading && !landQ.isLoading && (r.parcel_index === null || !sizes.isLoading);
  const result = useMemo(() => {
    const span = asSpan(build.data?.span);
    // XL (128-wide) builds are compared by mapping each voxel onto its 64-cell.
    const f = span / FORGE_SPAN;
    const base = build.data?.data ? decodeBuild(build.data.data, span) : [];
    const existing = mergeParcelBuilds(base, (landQ.data?.parcels ?? []).map((p) => ({ ...p, blocks: decodeBuild(p.data) })), f);
    const rects = sizes.data?.classes ? parcelRects(sizes.data.classes) : null;
    return classifyProposal(r.blocks ?? [], existing, r.parcel_index, rects, f);
  }, [build.data, landQ.data, sizes.data, r]);
  const c = result.counts;
  const tog = (on: boolean) => `rounded border px-2 py-0.5 font-mono text-[10px] ${on ? "border-signal text-signal" : "border-border text-muted-foreground"}`;
  return (
    <div className="mt-2 space-y-1">
      <div className="h-72 w-full overflow-hidden rounded border border-border bg-background">
        <ClientOnly fallback={null}>
          <Suspense fallback={<p className="p-2 font-mono text-[11px] text-muted-foreground">LOADING 3D…</p>}>
            <ProposalGhost3D height={r.bitmap_height} blocks={result.blocks} model={r.model_inscription_id} showLand={land} showGhost={ghost} />
          </Suspense>
        </ClientOnly>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => setLand(!land)} className={tog(land)}>EXISTING LAND</button>
        <button type="button" onClick={() => setGhost(!ghost)} className={tog(ghost)}>PROPOSED (GHOST)</button>
        {r.model_inscription_id && <span className="font-mono text-[10px] text-primary">+ REGISTERED MODEL</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]" aria-label="Legend">
        {!ready ? <span className="text-muted-foreground">CHECKING LAND…</span> : <>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5" style={{ background: "#3fd6e6" }} />FREE GROUND · {c.ok}</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5" style={{ background: "#f7931a" }} />OVERLAPS EXISTING BUILD · {c.overlap}</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5" style={{ background: "#ff3b3b" }} />OUTSIDE PARCEL · {c.outside}</span>
          {result.parcelUnverified && <span className="text-destructive">PARCEL MAP UNAVAILABLE · GROUND NOT VERIFIED</span>}
          {c.overlap + c.outside === 0 ? <span className="text-signal">✓ CLEAN</span> : <span className="text-primary">REVIEW BEFORE OPENING</span>}
        </>}
      </div>
      <div>
        <span className="font-mono text-[10px] text-muted-foreground">DRAG TO ORBIT · SCROLL TO ZOOM</span>
      </div>
    </div>
  );
}

/** Open-format exports: .bwvx (Bitcoin-native), .glb (Blender/Unreal, one merged mesh) and the one-draw-call Three.js loader. */
function ProposalExports({ r }: { r: BuildRow }) {
  const name = `${r.bitmap_height}${r.parcel_index !== null ? `-p${r.parcel_index}` : ""}-proposal`;
  const run = (f: (m: typeof import("@/lib/bwvx-export")) => Promise<string> | string) =>
    void import("@/lib/bwvx-export").then(async (m) => toast.success(await f(m))).catch((e) => toast.error(String(e?.message ?? e)));
  const btn = "rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground";
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      <button type="button" className={btn} onClick={() => run((m) => `.BWVX saved · ${m.downloadBwvx(m.tuplesToBlocks(r.blocks), name).bytes.toLocaleString()} B`)}>EXPORT .BWVX</button>
      <button type="button" className={btn} onClick={() => run(async (m) => { const x = await m.downloadBuildGlb(m.tuplesToBlocks(r.blocks), name); return `.GLB saved · ${x.boxes} boxes · 1 mesh`; })}>EXPORT .GLB</button>
      <button type="button" className={btn} onClick={() => run(async (m) => {
        const code = `${m.BWVX_LOADER_JS}\n// ${name}\nexport const PAYLOAD = "${m.bwvxPayload(m.tuplesToBlocks(r.blocks))}";\n// scene.add(loadBWVX(PAYLOAD));\n`;
        await navigator.clipboard.writeText(code); return "Loader + payload copied";
      })}>COPY THREE.JS LOADER</button>
    </div>
  );
}

function BuildProposals() {
  const [open, setOpen] = useState<string | null>(null);
  const navigate = useNavigate();
  const [rows, setRows] = useState<BuildRow[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    setSignedIn(!!u.user);
    if (!u.user) { setRows([]); return; }
    const { data } = await supabase.from("build_proposals").select("id, bitmap_height, parcel_index, role, block_count, note, model_inscription_id, status, created_at, blocks").order("created_at", { ascending: false }).limit(20);
    setRows((data ?? []) as unknown as BuildRow[]);
  };
  useEffect(() => { void load(); }, []);
  const decide = async (r: BuildRow, status: "applied" | "rejected") => {
    await supabase.from("build_proposals").update({ status }).eq("id", r.id);
    if (status === "applied") {
      void navigate({ to: "/forge", search: { height: r.bitmap_height, ...(r.parcel_index !== null ? { parcel: r.parcel_index } : {}), proposal: r.id } });
    } else void load();
  };
  return (
    <section className="glass-panel rounded-[18px] border border-border p-4">
      <h2 className="font-mono text-[12px] tracking-widest text-primary">AGENT BUILD PROPOSALS · {rows?.filter((r) => r.status === "pending").length ?? 0} PENDING</h2>
      <p className="mt-1 text-xs text-muted-foreground">Builds your agents suggested for land you hold. Opening one puts it on the Land Forge canvas; nothing is inscribed until you do it yourself.</p>
      {!signedIn ? <p className="mt-2 text-sm text-muted-foreground">Sign in to see build proposals from your agents.</p>
        : rows === null ? <p className="mt-2 font-mono text-[11px] text-muted-foreground">LOADING…</p>
        : rows.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No build proposals yet.</p> : (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className={`rounded border border-border p-2 ${open === r.id ? "md:col-span-2" : ""}`}>
              <div className="flex gap-3">
              <BuildTopView blocks={r.blocks ?? []} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-mono text-sm text-foreground">{r.bitmap_height}.bitmap{r.parcel_index !== null ? ` · parcel #${r.parcel_index}` : ""}</div>
                <div className="font-mono text-[11px] text-signal">{r.block_count.toLocaleString()} VOXELS · {new Date(r.created_at).toLocaleDateString()}</div>
                {r.note && <div className="text-xs text-muted-foreground">Why: {r.note}</div>}
                {r.status === "pending" ? (
                  <div className="flex gap-1 pt-1">
                    <button type="button" onClick={() => void decide(r, "applied")} className="rounded border border-primary/50 px-2 py-0.5 font-mono text-[11px] text-primary">OPEN IN LAND FORGE</button>
                    <button type="button" onClick={() => void decide(r, "rejected")} className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">REJECT</button>
                  </div>
                ) : r.status === "applied" ? (
                  <Link to="/forge" search={{ height: r.bitmap_height, ...(r.parcel_index !== null ? { parcel: r.parcel_index } : {}), proposal: r.id }} className="font-mono text-[11px] text-primary underline">REOPEN IN LAND FORGE</Link>
                ) : <span className="font-mono text-[11px] text-muted-foreground">REJECTED</span>}
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="block font-mono text-[11px] text-signal underline">{open === r.id ? "HIDE 3D COMPARE" : "COMPARE IN 3D"}</button>
                <ProposalExports r={r} />
              </div>
              </div>
              {open === r.id && <GhostCompare r={r} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function useNow() {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => { setT(Date.now() / 1000); const id = setInterval(() => setT(Date.now() / 1000), 1000); return () => clearInterval(id); }, []);
  return t;
}

function ColonyPage() {
  const t = useNow();
  const store = useProposalStore();
  const list = store.list;
  const pending = list.filter((p) => p.status === "pending");
  const [scan, setScan] = useState<string | null>(null);
  /** Approval re-reads the listing; it never builds, signs or submits anything. */
  async function approve(p: Proposal) {
    if (!p.offerId) return store.setStatus(p.id, "approved");
    const { data } = await supabase.from("offers").select("status, price_sats").eq("id", p.offerId).maybeSingle();
    const why = recheckListing(p, data ? { status: data.status, priceSats: Number(data.price_sats ?? 0) } : null);
    await store.setStatus(p.id, why ? "stale" : "approved", why ?? undefined);
  }
  async function askBroker() {
    setScan("Margo is reading the live listings…");
    try {
      const offers = await fetchOffers({ limit: 100 });
      const n = await store.proposeTrades(brokerPicks(offers.filter((o) => o.status === "open")));
      setScan(n > 0 ? `Margo proposed ${n} trade${n > 1 ? "s" : ""}. Nothing happens until you approve.` : "No new listings worth proposing right now.");
    } catch {
      setScan("Couldn't read the marketplace. Try again.");
    }
  }
  const used = new Set(CITIZENS.flatMap((c) => c.route));
  const spots = LANDMARKS.filter((l) => used.has(l.id)).map((l) => ({ l, ...landmarkSpot(l) }));
  const xs = spots.map((s) => s.x), zs = spots.map((s) => s.z);
  const pad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 0.15 + 1;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const px = (x: number) => ((x - minX) / (maxX - minX)) * 100;
  const pz = (z: number) => ((z - minZ) / (maxZ - minZ)) * 100;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header>
        <div className="font-mono text-[11px] tracking-widest text-signal">AGENT FRONTIER · LIVE</div>
        <h1 className="font-display text-3xl text-foreground">Agent Colony</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Citizens walk fixed routes between Oasis landmarks, so everyone sees them in the same place. They can walk and talk on their own. Any trade or spend waits here for the owner to approve, and an approved action only opens the normal page where you sign it yourself.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="glass-panel relative aspect-square rounded-[18px] border border-border p-2">
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-label="Colony map">
            {spots.map((s) => (
              <g key={s.l.id}>
                <rect x={px(s.x) - 1.5} y={pz(s.z) - 1.5} width={3} height={3} className="fill-muted-foreground/50" />
                <text x={px(s.x)} y={pz(s.z) - 2.5} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={2.2}>{s.l.label}</text>
              </g>
            ))}
            {t !== null && CITIZENS.map((c) => {
              const st = citizenAt(c, t);
              return <circle key={c.id} cx={px(st.x)} cy={pz(st.z)} r={1.6} fill={c.color}><title>{c.name}</title></circle>;
            })}
          </svg>
        </div>

        <div className="space-y-2">
          {CITIZENS.map((c) => {
            const st = t !== null ? citizenAt(c, t) : null;
            return (
              <div key={c.id} className="glass-panel flex items-center gap-3 rounded-[14px] border border-border p-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12px] tracking-widest text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.role} · {st ? st.activity : "locating…"}</div>
                </div>
                <span className={`font-mono text-[10px] ${st?.moving ? "text-signal" : "text-primary"}`}>{st ? (st.moving ? "MOVING" : "IDLE") : ""}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-panel rounded-[18px] border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[12px] tracking-widest text-primary">OWNER APPROVALS · {pending.length} PENDING</h2>
          <button type="button" onClick={askBroker} className="rounded border border-signal/50 px-2 py-0.5 font-mono text-[11px] text-signal">ASK BROKER FOR TRADES</button>
          <span className="font-mono text-[10px] text-muted-foreground">TRADE {needsApproval("trade") ? "NEEDS APPROVAL" : ""} · SPEND {needsApproval("spend") ? "NEEDS APPROVAL" : ""}</span>
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{store.signedIn ? "SAVED TO YOUR ACCOUNT · ONLY YOU CAN SEE THESE" : "SAVED ON THIS DEVICE · SIGN IN TO KEEP THEM ACROSS DEVICES"}</p>
        {scan && <p className="mt-2 font-mono text-[11px] text-signal">{scan}</p>}
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No agent has asked to trade or spend yet. When one does, it shows up here and nothing happens until you approve it.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-sm">
                <span className="font-mono text-[11px] uppercase text-signal">{p.kind}</span>
                {p.item ? (
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground"><span className="font-mono">{p.item}</span> · <span className="font-mono text-primary">{p.priceSats?.toLocaleString()} sats</span> <span className="text-xs text-muted-foreground">+ 2% fee</span></div>
                    <div className="text-xs text-muted-foreground">Why: {p.reason}</div>
                  </div>
                ) : <span className="flex-1 text-foreground">{p.summary}</span>}
                {p.status === "pending" ? (
                  <>
                    <button type="button" onClick={() => void approve(p)} className="rounded border border-primary/50 px-2 py-0.5 font-mono text-[11px] text-primary">APPROVE</button>
                    <button type="button" onClick={() => void store.setStatus(p.id, "rejected")} className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">REJECT</button>
                  </>
                ) : p.status === "approved" ? (
                  <a href={p.href} className="font-mono text-[11px] text-primary underline">OPEN & SIGN IN YOUR WALLET</a>
                ) : p.status === "stale" ? (
                  <span className="font-mono text-[11px] text-muted-foreground">OUT OF DATE · {p.staleWhy}</span>
                ) : <span className="font-mono text-[11px] text-muted-foreground">REJECTED</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <BuildProposals />

      {store.signedIn && (
        <section className="glass-panel rounded-[18px] border border-border p-4">
          <h2 className="font-mono text-[12px] tracking-widest text-signal">AUDIT TRAIL</h2>
          {store.audit.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No activity yet.</p> : (
            <ul className="mt-2 space-y-1 font-mono text-[11px]">
              {store.audit.map((e) => (
                <li key={e.id} className="flex gap-3 text-muted-foreground">
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                  <span className="uppercase text-foreground">{e.event}</span>
                  <span className="truncate">{e.proposal_id.replace("broker:", "")}{e.detail ? ` · ${e.detail}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Link to="/biternam" className="font-mono text-[11px] text-signal underline">← BITERNAM</Link>
    </main>
  );
}
