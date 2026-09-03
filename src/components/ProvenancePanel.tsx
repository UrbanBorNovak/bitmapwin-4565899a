import { useQuery } from "@tanstack/react-query";
import { provenanceQuery, provenanceScore, type VerificationStatus } from "@/lib/provenance";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";
import { timeAgo } from "@/lib/bitmap";

const NO_DATA = "NO DATA YET";

const STATUS: Record<VerificationStatus, { dot: string; label: string }> = {
  verified: { dot: "bg-emerald-500", label: "VERIFIED BY BITMAP INDEXER" },
  pending: { dot: "bg-bitcoin", label: "PENDING VERIFICATION" },
  unverifiable: { dot: "bg-destructive", label: "UNVERIFIABLE CLAIM" },
};

/** Lightweight verification chip derived from data the caller already holds. */
export function VerificationChip({
  inscriptionId,
  duplicateClaims = 0,
  className = "",
}: {
  inscriptionId: string | null | undefined;
  duplicateClaims?: number;
  className?: string;
}) {
  const status: VerificationStatus = inscriptionId ? "verified" : "pending";
  const meta = STATUS[status];
  const note = duplicateClaims > 0 ? `${meta.label} · ${duplicateClaims} LATER DUPLICATE(S) INVALID` : meta.label;
  return (
    <span
      className={`label inline-flex items-center gap-1.5 border border-border px-1.5 py-0.5 ${className}`}
      title={note}
    >
      <span className={`size-1.5 ${meta.dot}`} aria-hidden="true" />
      {status === "verified" ? "VERIFIED" : "PENDING"}
    </span>
  );
}

/** Full provenance panel: de-risks the buy decision with real records only. */
export function ProvenancePanel({
  height,
  ownerAddress,
}: {
  height: number;
  ownerAddress: string | null;
}) {
  const { data, isLoading } = useQuery(provenanceQuery(height, ownerAddress));

  if (isLoading || !data) {
    return (
      <section className="mt-10 border border-border bg-card p-5 md:p-6">
        <div className="label text-bitcoin">PROVENANCE</div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          &gt; READING ON-CHAIN RECORDS<span className="blink">_</span>
        </p>
      </section>
    );
  }

  const { score, grade } = provenanceScore(data);
  const meta = STATUS[data.verification];
  const owner = data.owner;

  return (
    <section className="mt-10 border border-border bg-card">
      <header className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div>
          <div className="label text-bitcoin">PROVENANCE SCORE</div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="display text-3xl md:text-4xl">{score}</span>
            <span className="label">/ 100 · {grade}</span>
          </div>
          <div className="mt-3 h-1.5 w-full max-w-[280px] bg-surface" aria-hidden="true">
            <div className="h-full bg-bitcoin" style={{ width: `${score}%` }} />
          </div>
        </div>
        <div className="sm:text-right">
          <span className="label inline-flex items-center gap-2 border border-border px-2 py-1">
            <span className={`size-2 ${meta.dot}`} aria-hidden="true" />
            {meta.label}
          </span>
          <p className="mt-2 max-w-xs font-mono text-[10px] leading-relaxed text-muted-foreground sm:ml-auto">
            {data.verificationNote}
          </p>
        </div>
      </header>

      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
        <Cell
          k="HISTORY DEPTH"
          v={data.transfers > 0 ? `${data.transfers} TRACED TRANSFER${data.transfers === 1 ? "" : "S"}` : NO_DATA}
          sub={data.lastTransferAt ? `LAST MOVE ${timeAgo(data.lastTransferAt)}` : "NO TRANSFER TRACED YET"}
        />
        <Cell
          k="PAID SALES"
          v={data.paidSales > 0 ? String(data.paidSales) : NO_DATA}
          sub={
            data.lastSaleAt && data.lastSaleSats
              ? `LAST SALE ${formatSats(data.lastSaleSats)} · ${timeAgo(data.lastSaleAt)}`
              : "NO SETTLED SALE ON CHAIN"
          }
        />
        <Cell
          k="ATTENTION"
          v={data.totalViews !== null ? `${data.totalViews.toLocaleString("en-US")} VIEWS` : NO_DATA}
          sub={data.lastViewedAt ? `LAST VISIT ${timeAgo(data.lastViewedAt)}` : "NO TRACKED VISIT YET"}
        />
        <Cell
          k="CLAIM INTEGRITY"
          v={
            data.verification === "unverifiable"
              ? "INVALID CLAIM"
              : data.duplicateClaims === 0
                ? "FIRST CLAIM ONLY"
                : `${data.duplicateClaims} LATER DUPLICATE(S) INVALID`
          }
          sub={data.inscriptionId ? `INSCRIPTION ${data.inscriptionId.slice(0, 12)}…` : "INSCRIPTION ID NOT RESOLVED YET"}
        />
        <Cell
          k="HOLDER TRACK RECORD"
          v={
            !owner
              ? NO_DATA
              : owner.salesMade > 0
                ? `${owner.salesMade} SALE${owner.salesMade === 1 ? "" : "S"} · ${formatSats(owner.volumeSats)}`
                : NO_DATA
          }
          sub={
            owner
              ? `${shortenAddress(owner.address)} · ${owner.bitmaps} BITMAP${owner.bitmaps === 1 ? "" : "S"} TRACED · ${owner.purchases} BUY${owner.purchases === 1 ? "" : "S"}`
              : "HOLDER NOT RESOLVED YET"
          }
        />
        <Cell
          k="FIRST INDEXED"
          v={data.firstSeenAt ? timeAgo(data.firstSeenAt) : NO_DATA}
          sub="WHEN THIS CLAIM ENTERED OUR REGISTRY"
        />
      </div>

      <p className="border-t border-border p-4 font-mono text-[10px] leading-relaxed text-muted-foreground md:px-6">
        &gt; EVERY FIGURE ABOVE COMES FROM INDEXED BITCOIN TRANSACTIONS OR TRACKED VISITS. NOTHING IS
        ESTIMATED — MISSING RECORDS READ AS {NO_DATA}.
      </p>
    </section>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub: string }) {
  const empty = v === NO_DATA;
  return (
    <div className="border-b border-border p-5 sm:[&:nth-child(2n)]:border-l lg:[&:nth-child(2n)]:border-l-0 lg:[&:not(:nth-child(3n+1))]:border-l md:p-6">
      <div className="label">{k}</div>
      <div className={`display mt-2 text-sm ${empty ? "text-muted-foreground" : "text-foreground"}`}>
        {v}
      </div>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}
