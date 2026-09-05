import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DataBadge } from "@/components/extenders/DataBadge";
import { categoryGlyph, landGrantsQuery, tileDeploymentsQuery } from "@/lib/extenders";
import { bitmapLeaseQuery } from "@/lib/leases";
import { shortenAddress } from "@/lib/registry";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * The territory view of one BITMAP: what software runs on it, who else may
 * build there, and whether it is currently leased. Ownership itself stays on
 * chain — this panel only reads the rights layered on top of it.
 */
export function TerritoryPanel({ height, ownerAddress }: { height: number; ownerAddress: string | null }) {
  const wallet = useWalletSession();
  const isOwner = Boolean(
    ownerAddress && wallet?.ordinalsAddress && ownerAddress.toLowerCase() === wallet.ordinalsAddress.toLowerCase(),
  );
  const deployments = useQuery(tileDeploymentsQuery(height));
  const grants = useQuery(landGrantsQuery(height));
  const lease = useQuery(bitmapLeaseQuery(height));

  const stack = deployments.data ?? [];
  const grantList = grants.data ?? [];

  return (
    <section className="border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="label">TERRITORY · {height}.BITMAP</h2>
        <DataBadge kind="live" />
      </header>

      <div className="space-y-6 p-4">
        <div>
          <div className="label text-bitcoin">RUNNING EXTENDERS</div>
          {deployments.isPending ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">&gt; READING TILE STACK…</p>
          ) : stack.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              &gt; NOTHING DEPLOYED HERE YET — THIS LAND IS BARE
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stack.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2">
                  <Link to="/extenders/$slug" params={{ slug: d.slug }} className="min-w-0 font-mono text-xs hover:text-bitcoin">
                    <span aria-hidden="true">{categoryGlyph(d.category)}</span> {d.name}
                    <span className="ml-2 text-muted-foreground" data-no-translate>v{d.semver}</span>
                  </Link>
                  <span className="label shrink-0 text-muted-foreground" data-no-translate>
                    {d.grantedVia.toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="label">BUILD RIGHTS GRANTED</div>
            {grantList.length === 0 ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">&gt; OWNER ONLY</p>
            ) : (
              <ul className="mt-2 space-y-1 font-mono text-[11px]">
                {grantList.map((g) => (
                  <li key={g.id} data-no-translate>
                    {shortenAddress(g.granteeAddress)} · {g.permissions.join(" / ").toUpperCase()}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="label">LEASE STATUS</div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground" data-no-translate>
              {lease.data?.active ? `LEASED · ENDS ${lease.data.active.endsAt.slice(0, 10)}` : "NOT LEASED"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Link to="/extenders" className="btn-term-ghost">[ BROWSE EXTENDERS ]</Link>
          {isOwner ? <Link to="/my-world" className="btn-term-ghost">[ MANAGE IN MY WORLD ]</Link> : null}
        </div>
      </div>
    </section>
  );
}
