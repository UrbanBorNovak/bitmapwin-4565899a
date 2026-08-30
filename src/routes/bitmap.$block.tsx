import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BitmapPixelMap } from "@/components/BitmapPixelMap";
import { bitmapQuery } from "@/lib/bitmap-queries";
import { STATUS_LABEL, formatBtc } from "@/lib/bitmap";

export const Route = createFileRoute("/bitmap/$block")({
  loader: async ({ context, params }) => {
    const block = Number(params.block);
    if (!Number.isFinite(block)) throw notFound();
    const bitmap = await context.queryClient.ensureQueryData(bitmapQuery(block));
    if (!bitmap) throw notFound();
    return { block };
  },
  head: ({ params }) => {
    const title = `Bitmap #${params.block} — Bitcoin Digital Land`;
    const description = `Ownership, status and price data for Bitmap parcel #${params.block} on the Bitcoin land layer.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: BitmapDetail,
  notFoundComponent: BitmapMissing,
});

function BitmapDetail() {
  const { block } = Route.useLoaderData();
  const { data } = useSuspenseQuery(bitmapQuery(block));
  if (!data) return <BitmapMissing />;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <Link to="/explore" className="label hover:text-foreground">
        ← BACK TO EXPLORER
      </Link>
      <h1 className="display mt-4 text-4xl md:text-6xl">BITMAP #{data.block_height}</h1>
      <p className="label mt-3">DIGITAL LAND ON BITCOIN</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="group border border-border bg-card p-6">
          <BitmapPixelMap blockHeight={data.block_height} />
        </div>

        <div className="border border-border">
          <div className="border-b border-border px-6 py-3">
            <span className="label">BITMAP DATA</span>
          </div>
          <dl className="divide-y divide-border">
            <Field k="BLOCK HEIGHT" v={String(data.block_height)} />
            <Field k="BITCOIN NETWORK" v="MAINNET" />
            <Field k="OWNER" v={data.owner_address ?? "UNCLAIMED"} />
            <Field k="STATUS" v={STATUS_LABEL[data.status] ?? data.status.toUpperCase()} />
            <Field k="PRICE" v={formatBtc(data.price_btc)} />
            <Field k="INSCRIPTION ID" v={data.inscription_id ?? "—"} />
          </dl>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          className="btn-term disabled:opacity-30"
          disabled={data.status !== "for_sale"}
          onClick={() =>
            toast(`BITMAP #${data.block_height}`, {
              description: "Settlement layer not connected in this prototype.",
            })
          }
        >
          [ BUY BITMAP ]
        </button>
        <a
          className="btn-term-ghost"
          href={`https://mempool.space/block/${data.block_height}`}
          target="_blank"
          rel="noreferrer"
        >
          [ VIEW ON EXPLORER ]
        </a>
        <button
          className="btn-term-ghost"
          onClick={() => toast("TRANSACTION DATA PENDING INDEXER")}
        >
          [ VIEW TRANSACTION ]
        </button>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-6 py-4">
      <dt className="label">{k}</dt>
      <dd className="mt-1 break-all font-mono text-sm text-foreground">{v}</dd>
    </div>
  );
}

function BitmapMissing() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-24 md:px-8">
      <h1 className="display text-3xl">PARCEL NOT INDEXED</h1>
      <p className="mt-4 font-mono text-sm text-muted-foreground">
        &gt; THIS BLOCK IS NOT PRESENT IN THE DEMO REGISTRY<span className="blink">_</span>
      </p>
      <Link to="/explore" className="btn-term mt-8">
        [ BACK TO EXPLORER ]
      </Link>
    </div>
  );
}
