/**
 * BITMAP VALUATION INDEX panel.
 *
 * Renders the recursive-only valuation report: hard verification checks,
 * weighted score, territory, holder dispersion, sat geology, UTXO audit,
 * inscription inventory and the raw audit JSON. Every figure comes from the
 * scan, which reads ord recursive endpoints on the server.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { runValuationScan } from "@/lib/valuation.functions";
import {
  ORD_BASE,
  V_CATEGORIES,
  fmtBtc,
  fmtNum,
  nodeMatches,
  scoreTier,
  shortHash,
  type ValuationReport,
} from "@/lib/valuation";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export function BitmapValuation({
  height,
  claimInscriptionId,
}: {
  height: number;
  claimInscriptionId: string | null;
}) {
  const [armed, setArmed] = useState(false);
  const [full, setFull] = useState(true);

  const scan = useQuery({
    queryKey: ["bvi", height, claimInscriptionId, full],
    queryFn: () =>
      runValuationScan({ data: { height, claimId: claimInscriptionId, full } }),
    enabled: armed,
    staleTime: 10 * 60_000,
    retry: 0,
  });

  return (
    <section className="mt-10 border border-border" aria-label="Bitmap valuation index">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div>
          <h2 className="label">BITMAP VALUATION INDEX</h2>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            BVI-4 · RECURSIVE ENDPOINTS ONLY · NO OFF-CHAIN INDEX
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-term-ghost !px-3 !py-2"
            aria-pressed={!full}
            onClick={() => {
              setFull(false);
              setArmed(true);
            }}
          >
            [ TERRITORY ONLY ]
          </button>
          <button
            type="button"
            className="btn-term !px-3 !py-2"
            disabled={scan.isFetching}
            onClick={() => {
              setFull(true);
              setArmed(true);
              scan.refetch();
            }}
          >
            {scan.isFetching ? "[ SCANNING… ]" : "[ FULL SCAN ]"}
          </button>
        </div>
      </header>

      {!armed ? (
        <p className="px-4 py-6 font-mono text-[11px] text-muted-foreground sm:px-6">
          &gt; RUN A SCAN TO VALUE BITMAP {height}. THE SCAN READS THE CLAIM TEXT, THE BLOCK
          ITSELF, THE FULL CHILD TREE, HOLDERS, SAT GEOLOGY AND UTXOS STRAIGHT FROM CHAIN.
        </p>
      ) : scan.isPending || scan.isFetching ? (
        <p className="px-4 py-6 font-mono text-[11px] text-muted-foreground sm:px-6">
          &gt; WALKING THE INSCRIPTION TREE… THIS TAKES A MOMENT ON DEVELOPED DISTRICTS.
        </p>
      ) : scan.isError ? (
        <p className="px-4 py-6 font-mono text-[11px] text-destructive sm:px-6">
          &gt; SCAN FAILED: {(scan.error as Error).message.toUpperCase()}
        </p>
      ) : scan.data ? (
        <Report report={scan.data} />
      ) : null}
    </section>
  );
}

function Report({ report }: { report: ValuationReport }) {
  const tier = scoreTier(report.score);
  const [category, setCategory] = useState<string>("ALL");
  const [depth, setDepth] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showAudit, setShowAudit] = useState(false);

  const rows = useMemo(
    () => report.nodes.filter((n) => nodeMatches(n, category, depth, search)),
    [report.nodes, category, depth, search],
  );
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const copyAudit = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast.success("AUDIT JSON COPIED");
    } catch {
      toast.error("CLIPBOARD BLOCKED — USE THE AUDIT PANEL BELOW");
    }
  };

  const downloadCsv = () => {
    const head = "id,depth,block,type,protocol,valid,size,fee,owner,sat_rarity";
    const body = rows
      .map((n) =>
        [
          n.id,
          n.depth,
          n.height ?? "",
          n.contentType,
          n.protocol,
          n.ok ? "yes" : "no",
          n.size ?? "",
          n.fee ?? "",
          n.address ?? "",
          n.rarity,
        ].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([`${head}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bvi-${report.height}-inventory.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* score + hard checks */}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border border-border p-4 text-center">
          <ScoreRing score={report.score} />
          <div className="display mt-3 text-lg">{tier.label}</div>
          <div className="label mt-1">CONFIDENCE {report.confidence}%</div>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">{tier.thesis}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Check label="DISTRICT TEXT" ok={report.claim.ok} detail={report.claim.body || "NOT READ"} />
          <Check
            label="CLAIM AFTER BLOCK"
            ok={report.claim.after}
            detail={report.claim.after ? "INSCRIBED AFTER THE BLOCK" : "NOT CONFIRMED"}
          />
          <Check
            label="HASH CROSS-CHECK"
            ok={report.hashMatch === true}
            detail={shortHash(report.land?.hash, 8)}
          />
          <Check
            label="VALID PARCELS"
            ok={report.counts.validParcels > 0}
            detail={`${fmtNum(report.counts.validParcels)} OF ${fmtNum(report.counts.parcels)} READ AS VALID`}
          />
        </div>
      </div>

      {/* territory + core metrics */}
      <Grid title="TERRITORY">
        <Stat k="BLOCK" v={fmtNum(report.height)} />
        <Stat k="TRANSACTIONS" v={fmtNum(report.land?.txCount)} />
        <Stat k="MAX PARCELS" v={fmtNum(report.land?.txCount)} />
        <Stat k="BLOCK FEES" v={`${fmtBtc(report.land?.totalFee)} BTC`} />
        <Stat k="SUBSIDY" v={`${fmtBtc(report.economics.subsidy)} BTC`} />
        <Stat
          k="MINED"
          v={report.land?.timestamp ? new Date(report.land.timestamp * 1000).toISOString().slice(0, 10) : "—"}
        />
        <Stat k="CHAIN TIP" v={fmtNum(report.tip.height)} />
        <Stat k="TIP HASH" v={shortHash(report.tip.hash)} />
      </Grid>

      <Grid title="DEVELOPMENT">
        <Stat k="INSCRIPTIONS FOUND" v={fmtNum(report.counts.nodes)} />
        <Stat k="TREE EDGES" v={fmtNum(report.counts.edges)} />
        <Stat k="MAX DEPTH" v={fmtNum(report.counts.depth)} />
        <Stat k="DISTINCT BLOCKS" v={fmtNum(report.counts.blocks)} />
        <Stat k="DISTINCT TXS" v={fmtNum(report.counts.txs)} />
        <Stat k="CONTENT KINDS" v={fmtNum(report.counts.categories.length)} />
        <Stat k="OWNERS" v={fmtNum(report.holders.length)} />
        <Stat k="RECENCY" v={`${report.recency}%`} />
      </Grid>

      {report.counts.capped ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          &gt; TREE LARGER THAN THE SCAN BUDGET — NUMBERS BELOW ARE A FLOOR, NOT A CEILING.
        </p>
      ) : null}

      {/* factor mix */}
      <div className="mt-8">
        <h3 className="label">FACTOR MIX</h3>
        <ul className="mt-3 space-y-2">
          {report.factors.map((f) => (
            <li key={f.label} className="grid grid-cols-[minmax(0,1fr)_60px] items-center gap-3">
              <div>
                <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                  <span className="uppercase">{f.label}</span>
                  <span className="text-muted-foreground">W{f.weight}</span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-border">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(1, Math.min(100, f.score))}%` }}
                  />
                </div>
              </div>
              <span className="font-mono text-[11px] text-right">{f.score.toFixed(0)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* holders + geology + utxo */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="border border-border p-4">
          <h3 className="label">HOLDER DISPERSION</h3>
          <dl className="mt-3 space-y-1 text-[11px]">
            <Row k="GINI" v={report.gini.toFixed(3)} />
            <Row k="HHI" v={report.hhi.toFixed(3)} />
            <Row k="OWNERS" v={fmtNum(report.holders.length)} />
          </dl>
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
            {report.holders.slice(0, 6).map((h) => (
              <li key={h.address} className="flex justify-between gap-2">
                <span>{shortHash(h.address, 7)}</span>
                <span>{fmtNum(h.count)}</span>
              </li>
            ))}
            {report.holders.length === 0 ? <li>NO OWNERS RESOLVED</li> : null}
          </ul>
        </div>

        <div className="border border-border p-4">
          <h3 className="label">SAT GEOLOGY</h3>
          <dl className="mt-3 space-y-1 text-[11px]">
            <Row k="SAT RANGES" v={fmtNum(report.geology.ranges)} />
            <Row k="SATS HELD" v={fmtNum(Number(report.geology.sats))} />
            <Row k="UNCOMMON" v={report.geology.uncommon} />
            <Row k="RARE" v={report.geology.rare} />
            <Row k="EPIC" v={report.geology.epic} />
            <Row k="LEGENDARY" v={report.geology.legendary} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-1">
            {report.charms.map((c) => (
              <span key={c.name} className="label border border-border px-2 py-1">
                {c.name.toUpperCase()} ×{c.count}
              </span>
            ))}
          </div>
        </div>

        <div className="border border-border p-4">
          <h3 className="label">UTXO + RUNES</h3>
          <dl className="mt-3 space-y-1 text-[11px]">
            <Row k="OUTPUTS AUDITED" v={fmtNum(report.utxo.outputs)} />
            <Row k="VERIFIED" v={fmtNum(report.utxo.verified)} />
            <Row k="UNVERIFIED" v={fmtNum(report.utxo.unverified)} />
            <Row k="SATS IN OUTPUTS" v={fmtNum(report.utxo.totalSats)} />
            <Row k="CO-LOCATED INSCRIPTIONS" v={fmtNum(report.utxo.coloc)} />
            <Row k="RUNE KINDS" v={fmtNum(report.utxo.runeKinds)} />
            <Row k="ENVELOPES DECODED" v={fmtNum(report.envelopes.length)} />
            <Row k="FEE MASS" v={`${fmtBtc(report.economics.feeMass)} BTC`} />
          </dl>
        </div>
      </div>

      {/* provenance */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="border border-border p-4">
          <h3 className="label">PROVENANCE</h3>
          <dl className="mt-3 space-y-1 text-[11px]">
            <Row k="DIRECT PARENTS" v={fmtNum(report.parents.length)} />
            <Row k="LINEAGE DEPTH" v={fmtNum(report.lineage.length)} />
          </dl>
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
            {report.lineage.map((id) => (
              <li key={id}>
                <a
                  href={`${ORD_BASE}/inscription/${id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary"
                >
                  ↑ {shortHash(id, 10)}
                </a>
              </li>
            ))}
            {report.lineage.length === 0 ? <li>NO PARENT LINEAGE READ</li> : null}
          </ul>
        </div>

        <div className="border border-border p-4">
          <h3 className="label">FEATURED ON THIS LAND</h3>
          <ul className="mt-3 space-y-2 font-mono text-[11px]">
            {report.featured.map((p) => (
              <li key={`${p.label}-${p.id}`} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">{p.label}</span>
                <a
                  href={`${ORD_BASE}/inscription/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary"
                >
                  {p.number != null ? `#${fmtNum(p.number)}` : shortHash(p.id, 8)}
                </a>
              </li>
            ))}
            {report.featured.length === 0 ? <li>NOTHING BUILT ON THIS LAND YET</li> : null}
          </ul>
        </div>
      </div>

      {/* timeline */}
      {report.timeline.length > 1 ? (
        <div className="mt-8 border border-border p-4">
          <h3 className="label">BUILD TIMELINE</h3>
          <Timeline points={report.timeline} />
        </div>
      ) : null}

      {/* inventory */}
      <div className="mt-8 border border-border">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <h3 className="label mr-auto">INVENTORY · {fmtNum(rows.length)}</h3>
          <select
            aria-label="Filter inventory by kind"
            className="border border-border bg-background px-2 py-2 font-mono text-[11px]"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            {V_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            aria-label="Filter inventory by depth"
            inputMode="numeric"
            placeholder="DEPTH"
            className="w-20 border border-border bg-background px-2 py-2 font-mono text-[11px]"
            value={depth}
            onChange={(e) => {
              setDepth(e.target.value.replace(/\D/g, ""));
              setPage(0);
            }}
          />
          <input
            aria-label="Search inventory"
            placeholder="SEARCH ID / OWNER / TYPE"
            className="min-w-[10rem] flex-1 border border-border bg-background px-2 py-2 font-mono text-[11px]"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          <button type="button" className="btn-term-ghost !px-3 !py-2" onClick={downloadCsv}>
            [ CSV ]
          </button>
          <button type="button" className="btn-term-ghost !px-3 !py-2" onClick={copyAudit}>
            [ COPY AUDIT ]
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2">INSCRIPTION</th>
                <th className="px-3 py-2">DEPTH</th>
                <th className="px-3 py-2">BLOCK</th>
                <th className="px-3 py-2">KIND</th>
                <th className="px-3 py-2">PROTOCOL</th>
                <th className="px-3 py-2">SIZE</th>
                <th className="px-3 py-2">OWNER</th>
                <th className="px-3 py-2">SAT</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((n) => (
                <tr key={n.id} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    <a
                      href={`${ORD_BASE}/inscription/${n.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary"
                    >
                      {n.number != null ? `#${fmtNum(n.number)}` : shortHash(n.id, 8)}
                    </a>
                  </td>
                  <td className="px-3 py-2">{n.depth}</td>
                  <td className="px-3 py-2">{fmtNum(n.height)}</td>
                  <td className="px-3 py-2">{n.contentType || "—"}</td>
                  <td className={`px-3 py-2 ${n.ok ? "text-primary" : ""}`}>
                    {n.protocol}
                    {n.ok ? " ✓" : ""}
                  </td>
                  <td className="px-3 py-2">{fmtNum(n.size)}</td>
                  <td className="px-3 py-2">{shortHash(n.address, 5)}</td>
                  <td className="px-3 py-2">{n.rarity}</td>
                </tr>
              ))}
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-muted-foreground">
                    NOTHING MATCHES THIS FILTER
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {pages > 1 ? (
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <button
              type="button"
              className="btn-term-ghost !px-3 !py-2"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              [ PREV ]
            </button>
            <span className="label">
              PAGE {page + 1} / {pages}
            </span>
            <button
              type="button"
              className="btn-term-ghost !px-3 !py-2"
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            >
              [ NEXT ]
            </button>
          </div>
        ) : null}
      </div>

      {/* audit */}
      <div className="mt-8">
        <button
          type="button"
          className="btn-term-ghost !px-3 !py-2"
          onClick={() => setShowAudit((v) => !v)}
        >
          {showAudit ? "[ HIDE AUDIT JSON ]" : "[ AUDIT JSON ]"}
        </button>
        {showAudit ? (
          <pre className="mt-3 max-h-80 overflow-auto border border-border bg-background p-3 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(report, null, 2)}
          </pre>
        ) : null}
        {report.errors.length > 0 ? (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            &gt; {report.errors.length} ENDPOINT READ(S) FAILED DURING THE SCAN — SCORE CONFIDENCE
            ADJUSTED DOWN.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} className="stroke-border" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="stroke-primary"
          strokeWidth="8"
          fill="none"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          strokeLinecap="butt"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display text-2xl">{score.toFixed(0)}</span>
        <span className="label">/100</span>
      </div>
    </div>
  );
}

function Check({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        <span className={`font-mono text-[11px] ${ok ? "text-primary" : "text-muted-foreground"}`}>
          {ok ? "PASS" : "UNPROVEN"}
        </span>
      </div>
      <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
        {detail.toUpperCase()}
      </p>
    </div>
  );
}

function Grid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h3 className="label">{title}</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-border p-3">
      <dt className="label">{k}</dt>
      <dd className="mt-1 break-all font-mono text-sm">{v}</dd>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-mono">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="break-all text-right">{v}</dd>
    </div>
  );
}

function Timeline({ points }: { points: ValuationReport["timeline"] }) {
  const w = 600;
  const h = 90;
  const t0 = points[0]!.timestamp;
  const t1 = points[points.length - 1]!.timestamp;
  const span = Math.max(1, t1 - t0);
  const maxFee = Math.max(1, ...points.map((p) => p.fee));
  const path = points
    .map((p, i) => {
      const x = ((p.timestamp - t0) / span) * w;
      const y = h - (p.fee / maxFee) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label="Inscription fees over time">
        <path d={path} className="stroke-primary" strokeWidth="1.5" fill="none" />
        {points.map((p) => (
          <circle
            key={`${p.height}-${p.timestamp}`}
            cx={((p.timestamp - t0) / span) * w}
            cy={h - (p.fee / maxFee) * (h - 8) - 4}
            r="1.8"
            className="fill-primary"
          />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{new Date(t0 * 1000).toISOString().slice(0, 10)}</span>
        <span>{points.length} INSCRIPTIONS</span>
        <span>{new Date(t1 * 1000).toISOString().slice(0, 10)}</span>
      </div>
    </div>
  );
}
