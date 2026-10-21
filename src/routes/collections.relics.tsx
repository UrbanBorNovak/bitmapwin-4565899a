import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RELIC_KINDS, RELIC_LABEL, TIER_LABEL, relicMasterHtml, relicMetadata, relicTribute, verifyRelic, withinTip, type RelicKind } from "@/lib/marauder-relics";
import { useChainTip } from "@/lib/use-chain-tip";
import { CollectionParentBadge } from "@/components/CollectionParentBadge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { relicHolderFn, relicPreviewFn } from "@/lib/relic-mint.functions";
import { DONATION_ADDRESS } from "@/lib/donations";
import { planRelicMint } from "@/lib/relic-mint-guard";

function RelicPayoutReview({ height, tip }: { height: number; tip: number }) {
  const fn = useServerFn(relicHolderFn);
  const q = useQuery({ queryKey: ["relic-holder", height], queryFn: () => fn({ data: { height } }), staleTime: 60_000 });
  const t = relicTribute(height);
  const holder = q.data?.holderAddress ?? null;
  // Parents are resolved at signing time; here we preview only the payout half of the guard.
  const plan = planRelicMint({ height, tip, holderAddress: holder, treasuryAddress: DONATION_ADDRESS,
    parents: [], bitmapParentId: null, masterInscriptionId: null });
  const payoutOk = plan.ok || !plan.missing.some((m) => m === "HOLDER" || m === "TREASURY" || m === "TIP");
  return (
    <div className="space-y-1 rounded border border-border p-2">
      <p className="text-muted-foreground">TRIBUTE: {t.total} SATS · {t.holder} TO BITMAP HOLDER · {t.treasury} TO TREASURY (+ MINER FEE)</p>
      <p className={holder ? "text-accent" : "text-destructive"}>
        HOLDER: {q.isLoading ? "CHECKING CHAIN…" : holder ? `${holder.slice(0, 10)}…${holder.slice(-6)} (VERIFIED LIVE)` : `NOT VERIFIED${q.data?.note ? ` — ${q.data.note}` : ""}`}
      </p>
      <p className={payoutOk ? "text-muted-foreground" : "text-destructive"}>{payoutOk ? "SIGNING ALSO REQUIRES BOTH PARENTS AT MINT TIME" : "SIGNING BLOCKED UNTIL HOLDER IS VERIFIED"}</p>
    </div>
  );
}

function RelicTxPreview({ height, tip, metadataBytes }: { height: number; tip: number; metadataBytes: number }) {
  const fn = useServerFn(relicPreviewFn);
  const [addr, setAddr] = useState("");
  const [rate, setRate] = useState("5");
  const [res, setRes] = useState<Awaited<ReturnType<typeof relicPreviewFn>> | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setRes(null);
    try {
      // Dev-only test hook: mocked chain facts run through the real preview builder, no network.
      const mock = import.meta.env.DEV ? (window as unknown as { __relicChainMock?: Record<string, unknown> }).__relicChainMock : undefined;
      if (mock) {
        const { buildRelicPreview } = await import("@/lib/relic-mint-preview");
        setRes(buildRelicPreview({ ...(mock as never), height, tip, minterAddress: addr.trim(), feeRate: Number(rate) || 0, metadataBytes, treasuryAddress: DONATION_ADDRESS }) as never);
      } else setRes(await fn({ data: { height, tip, minterAddress: addr.trim(), feeRate: Number(rate) || 0, metadataBytes } }));
    }
    catch (e) { setRes({ ok: false, message: (e as Error).message.slice(0, 160) }); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 rounded border border-border p-2">
      <p className="text-primary">UNSIGNED TRANSACTION PREVIEW</p>
      <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="RELIC GOES TO (YOUR ADDRESS)" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
      <div className="flex gap-2">
        <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className="w-20 rounded border border-border bg-background px-2 py-1 text-foreground" />
        <span className="self-center text-muted-foreground">SAT/VB</span>
        <button disabled={busy || addr.trim().length < 14} onClick={run} className="ml-auto rounded border border-accent px-2 py-1 text-accent disabled:opacity-40">{busy ? "CHECKING…" : "PREVIEW"}</button>
      </div>
      {res && !res.ok && <p className="text-destructive">{res.message}</p>}
      {res && res.ok && <div className="space-y-1">
        {res.parents.map((p) => <p key={p.inscriptionId} className="text-accent">✓ {p.role} PARENT {p.inscriptionId.slice(0, 10)}…{p.inscriptionId.slice(-4)}</p>)}
        <table className="w-full text-[10px]"><tbody>
          {res.outputs.map((o, i) => <tr key={i} className="border-t border-border"><td>{i}. {o.role}</td><td className="text-muted-foreground">{o.address.slice(0, 8)}…{o.address.slice(-4)}</td><td className="text-right">{o.sats}</td><td className="text-right text-muted-foreground">DUST {o.dust}</td></tr>)}
        </tbody></table>
        <p className="text-muted-foreground">TRIBUTE {res.tribute} SATS · MINER FEE ≈ {res.minerFee.toLocaleString()} SATS ({res.vbytes} VB × {res.feeRate})</p>
        <button disabled className="w-full rounded border border-border px-2 py-1 text-muted-foreground opacity-40">SIGN & BROADCAST — {res.signingNote}</button>
      </div>}
    </div>
  );
}

const TITLE = "Marauder Relics — dev9's BITMAP Collection";
const DESC = "Lean on-chain voxel relics: one master viewer, each relic a child of its BITMAP, derived only from the block height.";

export const Route = createFileRoute("/collections/relics")({
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Relics,
});

function Relics() {
  const [kind, setKind] = useState<RelicKind>("cassette");
  const [hText, setHText] = useState("840000");
  const height = Number(hText);
  const tip = useChainTip();
  const typed = hText !== "" && Number.isInteger(height);
  const valid = typed && withinTip(height, tip);
  const beyond = typed && tip > 0 && height > tip;
  const meta = useMemo(() => (valid ? relicMetadata(kind, height) : null), [kind, height, valid]);
  const html = useMemo(() => (meta ? relicMasterHtml(meta) : ""), [meta]);
  const check = meta ? verifyRelic(meta, tip) : null;
  const json = meta ? JSON.stringify(meta) : "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 font-sans">
      <p className="font-mono text-xs text-accent">COLLECTION · UNDER BITMAP</p>
      <h1 className="font-display text-4xl text-primary">MARAUDER RELICS</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">dev9's rules: one master viewer inscribed once, every relic inscribes no code, names its BITMAP as parent, and carries only its voxels. The relic is worked out from the block height, so anyone can check it.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          {meta ? <iframe title="Relic preview" srcDoc={html} sandbox="allow-scripts" className="aspect-square w-full border-0" />
            : <div className="grid aspect-square place-items-center font-mono text-sm text-muted-foreground">{beyond ? `UNMINED · BEYOND CHAIN TIP ${tip.toLocaleString()}` : tip ? "ENTER A MINED BLOCK HEIGHT" : "READING THE CHAIN TIP…"}</div>}
        </div>
        <div className="space-y-4 font-mono text-xs">
          <label className="block">BITMAP HEIGHT
            <input value={hText} onChange={(e) => setHText(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <p className={beyond ? "text-destructive" : "text-muted-foreground"}>{beyond ? "THAT BLOCK IS NOT MINED YET — PICK ONE AT OR BELOW THE TIP" : `CHAIN TIP: ${tip ? tip.toLocaleString() : "…"}`}</p>
          <div className="flex flex-wrap gap-1">
            {([["CURRENT TIP", tip], ["GENESIS", 0], ["PIZZA", 57043], ["HALVING 4", 840000]] as const).map(([l, h]) => (
              <button key={l} disabled={!tip} onClick={() => setHText(String(h))} className="rounded border border-border px-2 py-1 text-muted-foreground hover:text-primary disabled:opacity-40">{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {RELIC_KINDS.map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={`rounded border px-2 py-2 ${k === kind ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{RELIC_LABEL[k]}</button>
            ))}
          </div>
          {meta && <>
            <p className="text-accent">{check?.ok ? "✓ MATCHES THE BLOCK" : "✗ DOES NOT MATCH"} · {meta.v.split(";").length} VOXELS · 1 DRAW</p>
            <p className="text-primary">TIER: {TIER_LABEL[meta.r]}</p>
            <RelicPayoutReview height={height} tip={tip} />
            <div>
              <p className="text-muted-foreground">RELIC DATA (TAG 5) · {json.length} BYTES</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-background p-2 text-[10px]">{json}</pre>
            </div>
            <p className="text-muted-foreground">PLANNED PARENTS: collection + {height}.bitmap · VIEWER: master (not yet inscribed)</p>
          </>}
          <CollectionParentBadge highlight="MARAUDER RELICS" />
        </div>
      </div>
    </main>
  );
}
