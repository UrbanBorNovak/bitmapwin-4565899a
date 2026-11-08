import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";
import { GUARDIAN_MASTER_DELEGATE_ID } from "@/lib/guardian-delegate";
import { buildBeacon, buildMod, buildPage, buildSkin, isInscriptionId, type AddonKind, type PageInput } from "@/lib/addon-payloads";

export const Route = createFileRoute("/addons")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Add-on Inscriber · Guardian children — BITMAPWIN" },
      { name: "description", content: "Inscribe Guardian Master modules, profile pages, skins and tribute beacons as verified child inscriptions, right from your wallet." },
      { property: "og:title", content: "Add-on Inscriber — BITMAPWIN" },
      { property: "og:description", content: "Write a module or profile, check it, and inscribe it as a child of the inscription you hold." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddonsPage,
});

const WEATHER = `const { T, scene, on } = api;
const g = new T.BufferGeometry(), n = 80, p = new Float32Array(n * 3);
for (let i = 0; i < n * 3; i += 3) { p[i] = (Math.random() - .5) * 50; p[i + 1] = Math.random() * 28; p[i + 2] = (Math.random() - .5) * 50; }
g.setAttribute("position", new T.BufferAttribute(p, 3));
const pts = new T.Points(g, new T.PointsMaterial({ size: .6, color: 0xf7931a, transparent: true, opacity: .8 }));
scene.add(pts);
let busy = false;
fetch("/r/blockheight").then(r => r.text()).then(h => fetch("/r/blockinfo/" + h)).then(r => r.json()).then(b => { busy = (b.transaction_count || 0) > 4200; }).catch(() => {});
on((dt) => { for (let i = 1; i < n * 3; i += 3) { p[i] += dt * (busy ? -6 : 1.2); if (p[i] > 28) p[i] = 0; if (p[i] < 0) p[i] = 28; } g.attributes.position.needsUpdate = true; pts.material.color.setHex(busy ? 0x9be8ff : 0xf7931a); });`;

const ARRIVAL = `const { T, scene, on } = api;
const ring = new T.Mesh(new T.RingGeometry(1, 1.3, 48), new T.MeshBasicMaterial({ color: 0x3fe0d0, transparent: true, opacity: 0, side: 2 }));
ring.rotation.x = -Math.PI / 2; scene.add(ring);
let head = null, t = 0;
async function poll() { try { const r = await (await fetch("/r/children/${GUARDIAN_MASTER_DELEGATE_ID}/0")).json(); const ids = r.ids || []; const last = ids[ids.length - 1]; if (head && last && last !== head) t = 3; head = last || head; } catch (_) {} }
poll(); setInterval(poll, 45000);
on((dt) => { if (t > 0) { t -= dt; const k = 1 - t / 3; ring.scale.setScalar(1 + k * 14); ring.material.opacity = t / 3; } });`;

const KINDS: { k: AddonKind; label: string; who: string }[] = [
  { k: "mod", label: "MASTER MODULE", who: "Runs on every Guardian. Only the wallet holding the Guardian Master can inscribe it." },
  { k: "page", label: "PROFILE PAGE", who: "The card shown when someone taps your Guardian." },
  { k: "skin", label: "SKIN / HUD", who: "A frame or mask image drawn over your Guardian." },
  { k: "beacon", label: "TRIBUTE BEACON", who: "An address people can tip your Guardian at." },
];

const input = "w-full rounded border border-border bg-background px-3 py-1.5 font-mono text-xs";

function AddonsPage() {
  const [kind, setKind] = useState<AddonKind>("page");
  const [parent, setParent] = useState("");
  const [mod, setMod] = useState({ id: "MEMPOOL_WEATHER", label: "Live Mempool Weather", goal: 0, code: WEATHER });
  const [page, setPage] = useState<PageInput>({ title: "", status: "", bio: "", likes: "", dislikes: "", top8: "", accent: "#f7931a", x: "", pfp: "" });
  const [skin, setSkin] = useState({ name: "", frame: "", mask: "", accent: "#3fe0d0", scan: 0.3 });
  const [beacon, setBeacon] = useState("");

  const parentId = kind === "mod" ? GUARDIAN_MASTER_DELEGATE_ID : parent.trim();
  const res = useMemo(() => {
    if (kind === "mod") return buildMod(mod);
    if (kind === "page") return buildPage(page);
    if (kind === "skin") return buildSkin(skin);
    return buildBeacon(beacon);
  }, [kind, mod, page, skin, beacon]);
  const problems = [...res.problems, ...(isInscriptionId(parentId) ? [] : ["ENTER YOUR GUARDIAN'S INSCRIPTION ID"])];
  const bytes = new TextEncoder().encode(res.text);
  const digest = bytesToHex(sha256(bytes)).slice(0, 32);
  const P = (k: keyof PageInput, label: string, area = false) => (
    <label className="block"><span className="label text-muted-foreground">{label}</span>
      {area ? <textarea rows={3} value={page[k]} onChange={(e) => setPage({ ...page, [k]: e.target.value })} className={input} />
        : <input value={page[k]} onChange={(e) => setPage({ ...page, [k]: e.target.value })} className={input} />}
    </label>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="label text-accent">CREATION · CHILD INSCRIPTIONS</p>
      <h1 className="mt-1 font-display text-3xl">Add-on Inscriber</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Write an add-on, check the exact text, then inscribe it as a child of the inscription you hold. Your parent passes through the same transaction and comes straight back to your wallet. The Master only reads children whose parent is proven on chain.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {KINDS.map((o) => (
          <button key={o.k} onClick={() => setKind(o.k)} className={`rounded border px-3 py-1.5 font-mono text-xs ${kind === o.k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{o.label}</button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{KINDS.find((o) => o.k === kind)!.who}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded border border-border bg-card/60 p-4">
          {kind === "mod" ? (
            <>
              <p className="label text-muted-foreground">PARENT · GUARDIAN MASTER</p>
              <p className="break-all font-mono text-[11px] text-accent">{GUARDIAN_MASTER_DELEGATE_ID}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setMod({ id: "MEMPOOL_WEATHER", label: "Live Mempool Weather", goal: 0, code: WEATHER })} className="rounded border border-border px-2 py-1 font-mono text-[11px]">PRESET · MEMPOOL WEATHER</button>
                <button onClick={() => setMod({ id: "ARRIVAL_BEACON", label: "New Guardian Arrival", goal: 0, code: ARRIVAL })} className="rounded border border-border px-2 py-1 font-mono text-[11px]">PRESET · ARRIVAL RING</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-1"><span className="label text-muted-foreground">ID</span><input value={mod.id} onChange={(e) => setMod({ ...mod, id: e.target.value })} className={input} /></label>
                <label className="col-span-1"><span className="label text-muted-foreground">LABEL</span><input value={mod.label} onChange={(e) => setMod({ ...mod, label: e.target.value })} className={input} /></label>
                <label className="col-span-1"><span className="label text-muted-foreground">GOAL (SATS, 0 = ON)</span><input value={mod.goal} onChange={(e) => setMod({ ...mod, goal: parseInt(e.target.value.replace(/\D/g, "") || "0", 10) })} className={input} /></label>
              </div>
              <label className="block"><span className="label text-muted-foreground">CODE</span>
                <textarea rows={14} value={mod.code} onChange={(e) => setMod({ ...mod, code: e.target.value })} spellCheck={false} className={input} /></label>
            </>
          ) : (
            <label className="block"><span className="label text-muted-foreground">PARENT · YOUR GUARDIAN INSCRIPTION ID</span>
              <input value={parent} onChange={(e) => setParent(e.target.value)} placeholder="…i0" className={input} /></label>
          )}
          {kind === "page" && (
            <>
              {P("title", "TITLE")}{P("status", "STATUS")}{P("bio", "BIO", true)}
              {P("likes", "LIKES (COMMA SEPARATED, UP TO 6)")}{P("dislikes", "DISLIKES")}
              {P("top8", "TOP 8 INSCRIPTION IDS (COMMA SEPARATED)")}{P("pfp", "PROFILE IMAGE INSCRIPTION ID (IMAGE OR HTML)")}
              {P("accent", "ACCENT COLOUR")}{P("x", "X HANDLE")}
            </>
          )}
          {kind === "skin" && (
            <>
              <label className="block"><span className="label text-muted-foreground">NAME</span><input value={skin.name} onChange={(e) => setSkin({ ...skin, name: e.target.value })} className={input} /></label>
              <label className="block"><span className="label text-muted-foreground">FRAME IMAGE INSCRIPTION ID</span><input value={skin.frame} onChange={(e) => setSkin({ ...skin, frame: e.target.value })} className={input} /></label>
              <label className="block"><span className="label text-muted-foreground">MASK IMAGE INSCRIPTION ID</span><input value={skin.mask} onChange={(e) => setSkin({ ...skin, mask: e.target.value })} className={input} /></label>
              <label className="block"><span className="label text-muted-foreground">ACCENT</span><input value={skin.accent} onChange={(e) => setSkin({ ...skin, accent: e.target.value })} className={input} /></label>
              <label className="block"><span className="label text-muted-foreground">SCANLINES {skin.scan}</span><input type="range" min={0} max={1} step={0.05} value={skin.scan} onChange={(e) => setSkin({ ...skin, scan: +e.target.value })} className="w-full" /></label>
            </>
          )}
          {kind === "beacon" && (
            <label className="block"><span className="label text-muted-foreground">TRIBUTE ADDRESS (sp1…, bc1p… OR bc1q…)</span>
              <input value={beacon} onChange={(e) => setBeacon(e.target.value)} className={input} /></label>
          )}
        </section>

        <section className="space-y-3">
          <div className="rounded border border-border bg-card/60 p-4">
            <div className="flex items-center justify-between"><p className="label text-muted-foreground">EXACT TEXT TO INSCRIBE</p><p className="font-mono text-[11px] text-accent">{bytes.length.toLocaleString("en-US")} BYTES</p></div>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">{res.text}</pre>
            <button onClick={() => navigator.clipboard.writeText(res.text)} className="mt-2 rounded border border-border px-2 py-1 font-mono text-[11px]">COPY TEXT</button>
          </div>
          {problems.length ? (
            <ul className="rounded border border-destructive/50 p-3 font-mono text-[11px] text-destructive">{problems.map((p) => <li key={p}>· {p}</li>)}</ul>
          ) : (
            <ShadowInscriber
              key={`${digest}-${parentId}`}
              slug={`addon-${kind}`}
              height={0}
              index={0}
              digest={`addon-${digest}`}
              artifactVariants={[{ key: kind, label: kind.toUpperCase(), contentType: "text/plain;charset=utf-8", source: res.text }]}
              artifactLabel="CHILD ADD-ON"
              actionLabel="INSCRIBE AS CHILD"
              description="Your wallet must hold the parent inscription. It is spent and returned to you in the same reveal, which makes this a proven child. You pay only the Bitcoin miner cost."
              allowUpload={false}
              heldParentId={parentId}
            />
          )}
          <p className="text-xs text-muted-foreground">Want to see it first? Open a Guardian in <Link to="/guardian-studio" className="text-primary underline">Guardian Studio</Link>.</p>
        </section>
      </div>
    </main>
  );
}
