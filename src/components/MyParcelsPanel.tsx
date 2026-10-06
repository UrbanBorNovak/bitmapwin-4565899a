import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { verifyHeldParcelsFn } from "@/lib/parcel-fief.functions";
import { FIEF_SPLIT } from "@/lib/coins";
import type { WalletSnapshot } from "@/lib/wallet";

/** Child parcels `{index}.{height}.bitmap` this wallet holds, verified against each district's on-chain scan. */
export function MyParcelsPanel({ address, snapshot }: { address: string; snapshot: WalletSnapshot | undefined }) {
  const claims = (snapshot?.utxos ?? []).flatMap((u) =>
    u.inscriptions.flatMap((i) => (i.parcel ? [{ id: i.id, index: i.parcel.index, height: i.parcel.height }] : [])),
  );
  const verified = useQuery({
    queryKey: ["my-parcels", address, claims.map((c) => c.id).join(",")],
    queryFn: () => verifyHeldParcelsFn({ data: { address, claims } }),
    enabled: claims.length > 0,
    staleTime: 5 * 60_000,
  });
  if (!snapshot) return null;
  const rows = verified.data ?? [];
  const valid = rows.filter((r) => r.valid);

  return (
    <section className="mt-10 border border-border bg-card/40 backdrop-blur">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <div className="label text-signal">LAND · MY PARCELS</div>
          <h2 className="display mt-1 text-xl">DISTRICT FIEFDOM</h2>
        </div>
        <span className="label">{claims.length === 0 ? "NO PARCELS IN WALLET" : verified.isLoading ? "VERIFYING ON CHAIN…" : `${valid.length} VALID · ${rows.length - valid.length} NOT COUNTED`}</span>
      </header>
      <p className="px-5 pt-4 font-mono text-xs text-muted-foreground">
        Each valid parcel is one share of its BITMAP. Every day, {FIEF_SPLIT.parcelPercent}% of that BITMAP's visitor BIT is split between its
        parcel holders by shares and paid to your BIT balance automatically. Only the first inscription claiming a transaction counts.
      </p>
      {claims.length === 0 ? (
        <p className="px-5 py-4 text-xs text-muted-foreground">No <span data-no-translate>{"{index}.{height}.bitmap"}</span> parcel inscriptions found in this wallet.</p>
      ) : (
        <ul className="grid gap-px bg-border p-px sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.inscriptionId} className="bg-background p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm text-bitcoin" data-no-translate>{r.index}.{r.height}.bitmap</span>
                <span className={`label ${r.valid ? "text-signal" : "text-muted-foreground"}`}>{r.valid ? "VALID SHARE" : "NOT COUNTED"}</span>
              </div>
              {r.valid ? (
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  YOUR STAKE {r.sharePercent.toFixed(1)}% · {r.holdersTotal} SHARES IN DISTRICT
                </p>
              ) : (
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">An earlier inscription claims this transaction, or it isn't a child of the BITMAP.</p>
              )}
              <div className="mt-3 flex gap-3 text-[11px]">
                <Link to="/bitmap/$block" params={{ block: String(r.height) }} className="text-signal hover:underline">OPEN DISTRICT</Link>
                <a href={`https://ordinals.com/inscription/${r.inscriptionId}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">INSCRIPTION ↗</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
