import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { conventionBadgeFn } from "@/lib/sovereign-stand.functions";
import { CONVENTION_TIERS, STAND_ID, standConfigJson } from "@/lib/sovereign-stand";

export const Route = createFileRoute("/stand/")({
  head: () => ({
    meta: [
      { title: "Sovereign Grandstand Protocol (BW-STAND-1) | BITMAPWIN" },
      { name: "description", content: "Inscribe one JSON file and any community gets a free, signature-seated 3D grandstand for BITMAP holders, plus a Convention Badge across stands." },
      { property: "og:title", content: "BW-STAND-1 · Sovereign Grandstand" },
      { property: "og:description", content: "Inscribe a stand, seat BITMAP holders with free signatures, earn Convention Badges across communities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StandIndex,
});

function StandIndex() {
  const nav = useNavigate();
  const [name, setName] = useState("My Community Launch");
  const [host, setHost] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [jumbo, setJumbo] = useState("Welcome, Bitmappers");
  const [openId, setOpenId] = useState("");
  const [addr, setAddr] = useState("");
  const [badge, setBadge] = useState<Awaited<ReturnType<typeof conventionBadgeFn>> | null>(null);
  const [busy, setBusy] = useState(false);

  const num = (s: string) => (s.trim() && /^\d+$/.test(s.trim()) ? Number(s.trim()) : undefined);
  const bitmap = num(min) !== undefined || num(max) !== undefined ? { min: num(min), max: num(max) } : undefined;
  const json = standConfigJson({ name: name.trim() || "Grandstand", host: host.trim() || undefined, bitmap, jumbotron: jumbo.split("\n").map((s) => s.trim()).filter(Boolean) });

  const check = async () => {
    setBusy(true);
    try { setBadge(await conventionBadgeFn({ data: { address: addr.trim() } })); } catch { setBadge({ stands: [], tier: null, error: "Not a valid Bitcoin address" }); } finally { setBusy(false); }
  };

  const field = "w-full rounded border border-border bg-background px-2 py-1 text-[12px]";
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 font-mono">
      <div className="text-[11px] tracking-[0.3em] text-signal">OPEN PROTOCOL · BW-STAND-1</div>
      <h1 className="font-display text-3xl">The Sovereign Grandstand</h1>
      <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">Any community can host a free launch stand. Inscribe one small file and that inscription becomes your stand forever. BITMAP holders sign one free message to take a numbered seat. Each seat keeps its signature, so anyone can check it again. There are no fees and no contracts.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3 text-[12px]">
        {[["1 · INSCRIBE", "Copy the file below and inscribe it as text/plain or application/json."], ["2 · SHARE", "Your stand lives at bitmapwin.app/stand/<inscription id>. Any site can read the same file and seats."], ["3 · SEAT", "Holders sign once. We check the signature and that they hold a BITMAP in your range, live."]].map(([t, b]) => (
          <div key={t} className="rounded border border-border bg-card p-3"><div className="text-bitcoin">{t}</div><p className="mt-1 leading-normal text-muted-foreground">{b}</p></div>
        ))}
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded border border-border bg-card p-4 text-[12px]">
          <div className="tracking-[0.3em] text-bitcoin">BUILD YOUR STAND FILE</div>
          <label className="block">Name<input className={field} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block">Host (optional)<input className={field} value={host} maxLength={60} onChange={(e) => setHost(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label>Lowest BITMAP<input className={field} inputMode="numeric" placeholder="any" value={min} onChange={(e) => setMin(e.target.value)} /></label>
            <label>Highest BITMAP<input className={field} inputMode="numeric" placeholder="any" value={max} onChange={(e) => setMax(e.target.value)} /></label>
          </div>
          <label className="block">Jumbotron lines (one per line)<textarea className={field} rows={3} value={jumbo} onChange={(e) => setJumbo(e.target.value)} /></label>
          <pre className="overflow-x-auto rounded border border-border bg-background p-2 text-[11px] text-signal" data-no-translate>{json}</pre>
          <button type="button" onClick={() => navigator.clipboard?.writeText(json)} className="rounded border border-bitcoin px-3 py-1 text-bitcoin">[ COPY FILE ]</button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2 rounded border border-border bg-card p-4 text-[12px]">
            <div className="tracking-[0.3em] text-bitcoin">OPEN A STAND</div>
            <input className={field} placeholder="inscription id (…i0)" value={openId} onChange={(e) => setOpenId(e.target.value)} data-no-translate />
            <button type="button" disabled={!STAND_ID.test(openId.trim().toLowerCase())} onClick={() => nav({ to: "/stand/$id", params: { id: openId.trim().toLowerCase() } })} className="rounded border border-signal px-3 py-1 text-signal disabled:opacity-40">[ ENTER STAND ]</button>
          </div>
          <div className="space-y-2 rounded border border-border bg-card p-4 text-[12px]">
            <div className="tracking-[0.3em] text-bitcoin">CONVENTION BADGE</div>
            <p className="text-muted-foreground">Take seats across stands to level up: {CONVENTION_TIERS.slice().reverse().map((t) => `${t.stands} stands = ${t.name}`).join(" · ")}.</p>
            <input className={field} placeholder="your bc1… address" value={addr} onChange={(e) => setAddr(e.target.value)} data-no-translate />
            <button type="button" disabled={busy || !addr.trim()} onClick={check} className="rounded border border-signal px-3 py-1 text-signal disabled:opacity-40">{busy ? "CHECKING…" : "[ CHECK BADGE ]"}</button>
            {badge ? (badge.error ? <p className="text-destructive">{badge.error}</p> : (
              <div>
                <div className="text-foreground">{badge.tier ? <span className="text-bitcoin">★ {badge.tier.name}</span> : "NO BADGE YET"} · {badge.stands.length} STAND{badge.stands.length === 1 ? "" : "S"}</div>
                <ul className="mt-1 space-y-0.5" data-no-translate>{badge.stands.map((s) => <li key={s.standId}><Link to="/stand/$id" params={{ id: s.standId }} className="text-muted-foreground underline">#{s.seat} · {s.standId.slice(0, 12)}…</Link></li>)}</ul>
              </div>
            )) : null}
          </div>
        </div>
      </section>
      <p className="mt-6 text-[11px] text-muted-foreground">Why the stand page isn't itself inscribed: inscription viewers block pages from talking to the network, so an inscribed page can't check signatures or wallets. The file you inscribe is the stand's permanent identity and rules. Any website can show it.</p>
    </main>
  );
}
