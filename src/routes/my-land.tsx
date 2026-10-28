import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { filterRoster, heightTags, type RosterFilter, type RosterRow } from "@/lib/holder-console";
import { DataBadge } from "@/components/extenders/DataBadge";
import { useWalletSession } from "@/lib/wallet-session";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { landStatusQuery } from "@/lib/land-status";
import { walletQuery } from "@/lib/wallet";
import { myDeploymentsQuery } from "@/lib/extenders";
import { HostEarnPanel } from "@/components/extenders/HostEarnPanel";
import { MyParcelsPanel } from "@/components/MyParcelsPanel";
import { HostEarnTutorial } from "@/components/extenders/HostEarnTutorial";
import { MySeatCard } from "@/components/launch/MySeatCard";

export const Route = createFileRoute("/my-land")({
  head: () => {
    const title = "My Land — BitmapWin";
    const description =
      "The BITMAPs your connected wallet holds on Bitcoin, with everything deployed and built on them.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: MyLandPage,
});

const FILTERS: [RosterFilter, string][] = [
  ["all", "ALL"], ["guardian", "GUARDIAN"], ["built", "BUILT"], ["deployed", "DEPLOYED"], ["rare", "RARE NUMBER"], ["empty", "UNTOUCHED"],
];

function MyLandPage() {
  const wallet = useWalletSession();
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const addresses = wallet ? [wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean) : [];
  const held = useQuery(heldHeightsQuery(addresses));
  // Same live Taproot scan as /wallet (shared cache); records are only a fallback.
  const live = useQuery(walletQuery(wallet?.ordinalsAddress ?? ""));
  const deployments = useQuery(myDeploymentsQuery(addresses));
  const statusHeights = live.data
    ? [...new Set(live.data.utxos.flatMap((u) => u.inscriptions.map((i) => i.bitmapHeight)).filter((h): h is number => h !== null))]
    : held.data ?? [];
  const statusQ = useQuery(landStatusQuery(statusHeights));

  if (!wallet) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="label text-bitcoin">LAND · MY LAND</div>
        <h1 className="display mt-4 text-3xl md:text-5xl">CONNECT TO SEE YOUR LAND</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          My Land reads the BITMAP inscriptions held by your wallet. Connect a Bitcoin wallet to see what you
          own and what is deployed on it.
        </p>
        <div className="mt-6">
          <Link to="/wallet" className="btn-term">[ CONNECT WALLET ]</Link>
        </div>
      </div>
    );
  }

  const liveHeights = live.data
    ? [...new Set(live.data.utxos.flatMap((u) => u.inscriptions.map((i) => i.bitmapHeight)).filter((h): h is number => h !== null))].sort((a, b) => a - b)
    : null;
  const usingLive = liveHeights !== null;
  const heights = liveHeights ?? held.data ?? [];
  const scanning = live.isLoading || (!usingLive && held.isLoading);
  const status = statusQ;
  const deployedOn = new Map<number, number>();
  for (const d of deployments.data ?? []) {
    deployedOn.set(d.bitmapHeight, (deployedOn.get(d.bitmapHeight) ?? 0) + 1);
  }

  const rows: RosterRow[] = heights.map((h) => ({
    height: h,
    built: !!status.data?.get(h)?.build,
    guardian: !!status.data?.get(h)?.guardian,
    deployments: deployedOn.get(h) ?? 0,
  }));
  const shown = filterRoster(rows, filter);
  const count = (f: RosterFilter) => filterRoster(rows, f).length;
  const hosting = (deployments.data ?? []).filter((d) => (d as { config?: { hostAndEarn?: boolean } }).config?.hostAndEarn).length;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">LAND · HOLDER COMMAND CONSOLE</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">MY LAND</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        One screen for everything this wallet holds, read live from Bitcoin: Guardians, builds, deployments and
        block-number facts — with a jump straight into the Oasis, the Forge or the full dossier.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note={usingLive ? "LIVE CHAIN SCAN" : "INDEXED RECORDS"} />
        <button type="button" className="btn-term-ghost" onClick={() => live.refetch()} disabled={live.isFetching}>{live.isFetching ? "[ SCANNING… ]" : "[ REFRESH ]"}</button>
        <Link to="/extend" className="btn-term">[ EXTEND MY LAND ]</Link>
        <Link to="/my-world" className="btn-term-ghost">[ MANAGE MY WORLD ]</Link>
      </div>

      <MySeatCard address={wallet.ordinalsAddress} />
      <section data-tour="myland-stats" className="mt-8 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-6">
        {[
          ["BITMAPS HELD", scanning ? "…" : String(heights.length), ""],
          ["INSCRIBED GUARDIANS", String(count("guardian")), "text-bitcoin"],
          ["BUILT BITMAPS", String(count("built")), "text-signal"],
          ["ACTIVE DEPLOYMENTS", String(deployments.data?.length ?? 0), ""],
          ["HOST & EARN", String(hosting), "text-signal"],
          ["RARE NUMBERS", String(count("rare")), "text-bitcoin"],
        ].map(([label, value, tone]) => (
          <div key={label} className="bg-background p-4">
            <div className="label">{label}</div>
            <div className={`display mt-2 text-2xl ${tone}`}>{value}</div>
          </div>
        ))}
      </section>
      <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground" data-no-translate>WALLET · {wallet.ordinalsAddress}</div>

      {scanning ? (
        <p className="mt-8 label">SCANNING WALLET HOLDINGS…</p>
      ) : heights.length === 0 ? (
        <div className="mt-8 border border-border p-8 text-center">
          <p className="label">NO BITMAPS DETECTED IN THIS WALLET YET.</p>
          <div className="mt-4">
            <Link to="/marketplace" className="btn-term">[ BROWSE THE MARKETPLACE ]</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {FILTERS.map(([f, label]) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={filter === f ? "btn-term text-[11px]" : "btn-term-ghost text-[11px]"}>
                {label} ({count(f)})
              </button>
            ))}
            <span className="ml-auto flex gap-1">
              <button type="button" className={view === "table" ? "btn-term text-[11px]" : "btn-term-ghost text-[11px]"} onClick={() => setView("table")}>TABLE</button>
              <button type="button" className={view === "cards" ? "btn-term text-[11px]" : "btn-term-ghost text-[11px]"} onClick={() => setView("cards")}>CARDS</button>
            </span>
          </div>
          {shown.length === 0 ? (
            <p className="mt-4 label">NOTHING MATCHES THIS FILTER.</p>
          ) : view === "table" ? (
            <div data-tour="myland-grid" className="mt-4 overflow-x-auto border border-border">
              <table className="w-full min-w-[720px] font-mono text-[12px]">
                <thead className="label text-left">
                  <tr className="border-b border-border">
                    <th className="p-3">BITMAP</th><th className="p-3">NUMBER FACTS</th><th className="p-3">GUARDIAN</th>
                    <th className="p-3">BUILD</th><th className="p-3">DEPLOYED</th><th className="p-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const st = status.data?.get(r.height);
                    return (
                      <tr key={r.height} className="border-b border-border/60 hover:bg-secondary/40">
                        <td className="p-3"><Link to="/bitmap/$block" params={{ block: String(r.height) }} className="display text-base hover:text-bitcoin">#{r.height}</Link></td>
                        <td className="p-3 text-bitcoin">{heightTags(r.height).join(" · ") || "—"}</td>
                        <td className="p-3">{st?.guardian ? <span className="text-bitcoin">◆ INSCRIBED</span> : <Link to="/mint" className="text-muted-foreground underline">AWAKEN</Link>}</td>
                        <td className="p-3">{st?.build ? <span className="text-signal">▣ {st.build.voxels} VOXELS</span> : "—"}</td>
                        <td className="p-3">{r.deployments || "—"}</td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Link to="/oasis" search={{ height: r.height }} className="btn-term text-[10px]">OASIS</Link>
                            <Link to="/forge" search={{ height: r.height }} className="btn-term-ghost text-[10px]">FORGE</Link>
                            <Link to="/bitmap/$block" params={{ block: String(r.height) }} className="btn-term-ghost text-[10px]">DOSSIER</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div data-tour="myland-grid" className="mt-4 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {shown.map((r) => {
                const st = status.data?.get(r.height);
                return (
                  <div key={r.height} className="flex flex-col bg-background">
                    <Link to="/bitmap/$block" params={{ block: String(r.height) }} className="group flex-1 p-4 hover:bg-secondary">
                      <div className="display text-lg">#{r.height}</div>
                      <div className="label mt-2 text-[0.55rem]">{r.deployments ? `${r.deployments} DEPLOYED` : "EMPTY LAND"}</div>
                      {heightTags(r.height).length > 0 && <div className="label mt-1 text-[0.55rem] text-bitcoin">{heightTags(r.height).join(" · ")}</div>}
                      {st?.build && <div className="label mt-1 text-[0.55rem] text-signal">▣ BUILT · {st.build.voxels} VOXELS</div>}
                      {st?.guardian && <div className="label mt-1 text-[0.55rem] text-bitcoin">◆ GUARDIAN INSCRIBED</div>}
                    </Link>
                    <div className="m-2 mt-0 grid grid-cols-2 gap-1">
                      <Link to="/oasis" search={{ height: r.height }} className="btn-term justify-center text-center text-[10px]">OASIS</Link>
                      <Link to="/forge" search={{ height: r.height }} className="btn-term-ghost justify-center text-center text-[10px]">FORGE</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <MyParcelsPanel address={wallet.ordinalsAddress} snapshot={live.data} />
      {!scanning && heights.length > 0 && (
        <>
          <HostEarnTutorial />
          <HostEarnPanel heights={heights} deployments={deployments.data ?? []} />
        </>
      )}
    </div>
  );
}
