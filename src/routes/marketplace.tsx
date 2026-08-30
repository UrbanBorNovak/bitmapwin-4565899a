import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BitmapCard } from "@/components/BitmapCard";
import { bitmapsQuery } from "@/lib/bitmap-queries";
import { formatBtc } from "@/lib/bitmap";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — Bitmap Digital Land Listings" },
      {
        name: "description",
        content: "Every Bitmap parcel currently listed for sale, priced in BTC.",
      },
      { property: "og:title", content: "Marketplace — Bitmap Digital Land Listings" },
      {
        property: "og:description",
        content: "Every Bitmap parcel currently listed for sale, priced in BTC.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bitmapsQuery(200)),
  component: Marketplace,
});

function Marketplace() {
  const { data: bitmaps } = useSuspenseQuery(bitmapsQuery(200));
  const listings = bitmaps.filter((b) => b.status === "for_sale");
  const prices = listings.map((b) => b.price_btc ?? 0);
  const floor = prices.length ? Math.min(...prices) : null;
  const volume = prices.reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <h1 className="display text-3xl md:text-5xl">MARKETPLACE</h1>
      <p className="label mt-3">ACTIVE LISTINGS ON THE LAND LAYER</p>

      <div className="mt-8 grid grid-cols-1 divide-border border border-border sm:grid-cols-3 sm:divide-x">
        <Stat k="LISTINGS" v={String(listings.length)} />
        <Stat k="FLOOR" v={formatBtc(floor)} />
        <Stat k="LISTED VALUE" v={formatBtc(volume)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((b) => (
          <BitmapCard key={b.id} bitmap={b} />
        ))}
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
