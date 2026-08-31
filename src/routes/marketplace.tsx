import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ParcelCard } from "@/components/ParcelCard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { registryParcelsQuery } from "@/lib/registry";
import { getBlockInscriptions, getRecentInscriptions } from "@/lib/ordinals-scan.functions";
import { saveChainInscriptions } from "@/lib/inscription-store";
import { formatBtc } from "@/lib/bitmap";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — Bitmap Digital Land Listings" },
      {
        name: "description",
        content:
          "Real on-chain Bitmap parcels from the inscription registry, with resolved owners and BTC prices.",
      },
      { property: "og:title", content: "Marketplace — Bitmap Digital Land Listings" },
      {
        property: "og:description",
        content:
          "Real on-chain Bitmap parcels from the inscription registry, with resolved owners and BTC prices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(registryParcelsQuery(300));
  },
  component: Marketplace,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8" role="alert">
      <h1 className="display text-3xl">MARKET FEED UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">&gt; {error.message}</p>
    </div>
  ),
  notFoundComponent: () => <EmptyRegistry />,
});

type Tab = "listed" | "all";

function Marketplace() {
  const { data: parcels } = useSuspenseQuery(registryParcelsQuery(300));
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const [syncHeight, setSyncHeight] = useState("");

  const sync = useMutation({
    mutationFn: async () => {
      const height = Number(syncHeight);
      const blocks =
        syncHeight.trim() !== "" && Number.isFinite(height)
          ? [await getBlockInscriptions({ data: { height, txPages: 12 } })]
          : await getRecentInscriptions({ data: { blocks: 8, txPages: 6 } });
      const found = blocks.flatMap((b) => b.inscriptions);
      const saved = await saveChainInscriptions(found);
      const claims = found.filter((i) => i.isBitmapClaim).length;
      return { saved, claims, blocks: blocks.length };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["registry"] });
      toast(`INDEXED ${r.saved} INSCRIPTION(S)`, {
        description: `${r.claims} BITMAP CLAIM(S) ACROSS ${r.blocks} BLOCKS`,
      });
    },
    onError: (e) => toast("CHAIN SYNC FAILED", { description: (e as Error).message }),
  });

  const listed = useMemo(() => parcels.filter((p) => p.listed), [parcels]);
  const visible = useMemo(() => {
    const base = tab === "listed" ? listed : parcels;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        String(p.bitmapHeight).includes(q) ||
        p.inscriptionId.toLowerCase().includes(q) ||
        p.txid.toLowerCase().includes(q) ||
        (p.ownerAddress ?? "").toLowerCase().includes(q),
    );
  }, [tab, listed, parcels, search]);

  const prices = listed.map((p) => p.priceBtc ?? 0).filter((p) => p > 0);
  const floor = prices.length ? Math.min(...prices) : null;
  const volume = prices.reduce((a, b) => a + b, 0);
  const holders = new Set(parcels.map((p) => p.ownerAddress).filter(Boolean)).size;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">MARKETPLACE</h1>
      <p className="label mt-3">ON-CHAIN PARCELS FROM THE INSCRIPTION REGISTRY</p>

      <div className="mt-8 grid grid-cols-2 divide-border border border-border sm:grid-cols-4 sm:divide-x">
        <Stat k="REGISTERED PARCELS" v={String(parcels.length)} />
        <Stat k="LISTED" v={String(listed.length)} />
        <Stat k="FLOOR" v={formatBtc(floor)} />
        <Stat k="HOLDERS" v={String(holders)} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          className={tab === "all" ? "btn-term" : "btn-term-ghost"}
          onClick={() => setTab("all")}
        >
          [ ALL PARCELS ]
        </button>
        <button
          className={tab === "listed" ? "btn-term" : "btn-term-ghost"}
          onClick={() => setTab("listed")}
        >
          [ FOR SALE ]
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH HEIGHT / OWNER / TXID"
          className="min-w-[240px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <input
          value={syncHeight}
          onChange={(e) => setSyncHeight(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="BLOCK TO INDEX"
          className="w-[150px] border border-border bg-background px-3 py-2 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <button
          className="btn-term-ghost"
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          {sync.isPending ? "[ SYNCING… ]" : "[ SYNC CHAIN ]"}
        </button>
        <span className="label">LISTED VALUE {formatBtc(volume)}</span>
      </div>

      {visible.length === 0 ? (
        <EmptyRegistry />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <ParcelCard key={p.inscriptionId} parcel={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyRegistry() {
  return (
    <div className="mt-10 border border-border p-10">
      <h2 className="display text-2xl">NO PARCELS IN THE REGISTRY YET</h2>
      <p className="mt-4 font-mono text-sm text-muted-foreground">
        &gt; BITMAP CLAIMS APPEAR HERE ONCE INSCRIPTIONS ARE INDEXED<span className="blink">_</span>
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link to="/explore" className="btn-term">
          [ SCAN THE CHAIN ]
        </Link>
        <Link to="/extractor" className="btn-term-ghost">
          [ INDEX A TRANSACTION ]
        </Link>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="p-6">
      <div className="label">{k}</div>
      <div className="display mt-2 text-2xl">{v}</div>
    </div>
  );
}
