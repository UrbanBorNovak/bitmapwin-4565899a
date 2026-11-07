import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listMySummonOrdersFn } from "@/lib/bitmon.functions";
import { useAuthSession } from "@/lib/auth";

const STATUS_TONE: Record<string, string> = {
  pending: "text-bitcoin",
  seen: "text-signal",
  settled: "text-signal",
  expired: "text-muted-foreground",
  taken: "text-muted-foreground",
};

/** Live tracker for the signed-in user's summon orders: confirmations until AWAKE. */
export function SummonDashboard() {
  const { session } = useAuthSession();
  const q = useQuery({
    queryKey: ["my-summon-orders"],
    queryFn: () => listMySummonOrdersFn(),
    enabled: Boolean(session),
    refetchInterval: 20_000,
  });
  if (!session) return null;
  const rows = q.data ?? [];

  return (
    <section className="panel mt-6 rounded-md border border-border p-4" aria-label="Summon dashboard">
      <div className="flex items-center justify-between gap-2">
        <p className="label text-signal">SUMMON DASHBOARD · LIVE CHAIN TRACKING</p>
        <span className="font-mono text-[10px] text-muted-foreground">{q.isFetching ? "SYNCING…" : "AUTO-REFRESH 20S"}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          {q.isPending ? "> READING YOUR SUMMON ORDERS…" : "NO SUMMONS YET — PICK A BITMAP ABOVE AND MINT ONE."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((o) => {
            const confs = o.confirmations;
            const label = o.awake
              ? "◆ AWAKE"
              : o.status === "expired"
                ? "✕ EXPIRED"
                : confs == null
                  ? "AWAITING PAYMENT"
                  : confs === 0
                    ? "IN MEMPOOL · 0 CONFIRMATIONS"
                    : `${confs} CONFIRMATION${confs === 1 ? "" : "S"}`;
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border px-3 py-2 font-mono text-[11px]">
                <Link to="/bitmap/$block" params={{ block: String(o.height) }} className="text-bitcoin hover:text-foreground">
                  {o.height}.BITMAP
                </Link>
                <span className={o.awake ? "font-bold text-signal" : STATUS_TONE[o.status] ?? ""}>{label}</span>
                <span className="text-muted-foreground">{o.amountSats.toLocaleString("en-US")} SATS</span>
                {o.txid ? (
                  <a
                    href={`https://mempool.space/tx/${o.txid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-signal underline"
                  >
                    TX {o.txid.slice(0, 10)}…
                  </a>
                ) : null}
                {!o.awake && o.status !== "expired" ? (
                  <span className="ml-auto h-1.5 w-24 overflow-hidden bg-border" aria-hidden="true">
                    <span
                      className={`block h-full ${confs ? "bg-signal" : "animate-pulse bg-bitcoin"}`}
                      style={{ width: confs == null ? "15%" : confs === 0 ? "35%" : "100%" }}
                    />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
