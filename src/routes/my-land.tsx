import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DataBadge } from "@/components/extenders/DataBadge";
import { useWalletSession } from "@/lib/wallet-session";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { landStatusQuery } from "@/lib/land-status";
import { walletQuery } from "@/lib/wallet";
import { myDeploymentsQuery } from "@/lib/extenders";
import { HostEarnPanel } from "@/components/extenders/HostEarnPanel";
import { MyParcelsPanel } from "@/components/MyParcelsPanel";
import { HostEarnTutorial } from "@/components/extenders/HostEarnTutorial";

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

function MyLandPage() {
  const wallet = useWalletSession();
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

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">LAND · MY LAND</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">MY LAND</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Every BITMAP this wallet holds, read live from Bitcoin — the same scan as your wallet page. Extend a tile to deploy software on it,
        or open it in the world.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note={usingLive ? "LIVE CHAIN SCAN" : "INDEXED RECORDS"} />
        <button type="button" className="btn-term-ghost" onClick={() => live.refetch()} disabled={live.isFetching}>{live.isFetching ? "[ SCANNING… ]" : "[ REFRESH ]"}</button>
        <Link to="/extend" className="btn-term">[ EXTEND MY LAND ]</Link>
        <Link to="/my-world" className="btn-term-ghost">[ MANAGE MY WORLD ]</Link>
      </div>

      <section data-tour="myland-stats" className="mt-8 grid grid-cols-2 border border-border md:grid-cols-4">
        <div className="border-b border-r border-border p-4">
          <div className="label">BITMAPS HELD</div>
          <div className="display mt-2 text-2xl">{scanning ? "…" : heights.length}</div>
        </div>
        <div className="border-b border-border p-4 md:border-r">
          <div className="label">WITH DEPLOYMENTS</div>
          <div className="display mt-2 text-2xl">{deployedOn.size}</div>
        </div>
        <div className="border-r border-border p-4">
          <div className="label">ACTIVE DEPLOYMENTS</div>
          <div className="display mt-2 text-2xl">{deployments.data?.length ?? 0}</div>
        </div>
        <div className="p-4">
          <div className="label">WALLET</div>
          <div className="mt-2 truncate font-mono text-xs">{wallet.ordinalsAddress}</div>
        </div>
      </section>

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
        <div data-tour="myland-grid" className="mt-8 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {heights.map((h) => (
            <div key={h} className="flex flex-col bg-background">
              <Link to="/bitmap/$block" params={{ block: String(h) }} className="group flex-1 p-4 hover:bg-secondary">
                <div className="display text-lg">#{h}</div>
                <div className="label mt-2 text-[0.55rem]">
                  {deployedOn.get(h) ? `${deployedOn.get(h)} DEPLOYED` : "EMPTY LAND"}
                </div>
                {status.data?.get(h)?.build && <div className="label mt-1 text-[0.55rem] text-signal">▣ BUILT · {status.data.get(h)!.build!.voxels} VOXELS</div>}
                {status.data?.get(h)?.guardian && <div className="label mt-1 text-[0.55rem] text-bitcoin">◆ GUARDIAN · {status.data.get(h)!.guardian!.species}</div>}
              </Link>
              <Link to="/oasis" search={{ height: h }} className="btn-term m-2 mt-0 justify-center text-center text-[11px]">
                ENTER OASIS →
              </Link>
            </div>
          ))}
        </div>
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
