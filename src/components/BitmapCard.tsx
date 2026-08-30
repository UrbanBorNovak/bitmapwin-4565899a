import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BitmapPixelMap } from "@/components/BitmapPixelMap";
import { STATUS_LABEL, formatBtc, type Bitmap } from "@/lib/bitmap";

export function BitmapCard({ bitmap, dense = false }: { bitmap: Bitmap; dense?: boolean }) {
  const status = STATUS_LABEL[bitmap.status] ?? bitmap.status.toUpperCase();

  return (
    <article className="group border border-border bg-card transition-[border-color,transform] duration-150 hover:border-foreground hover:-translate-y-0.5">
      <Link
        to="/bitmap/$block"
        params={{ block: String(bitmap.block_height) }}
        className="block border-b border-border p-4"
      >
        <BitmapPixelMap blockHeight={bitmap.block_height} />
      </Link>

      <div className={dense ? "p-3" : "p-4"}>
        <div className="display text-sm">BITMAP #{bitmap.block_height}</div>

        <dl className="mt-3 space-y-1 text-[11px]">
          <Row k="BLOCK" v={String(bitmap.block_height)} />
          <Row k="OWNER" v={bitmap.owner_address ?? "—"} />
          <Row k="STATUS" v={status} />
          <Row k="PRICE" v={formatBtc(bitmap.price_btc)} />
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/bitmap/$block"
            params={{ block: String(bitmap.block_height) }}
            className="btn-term-ghost !px-2 !py-2"
          >
            VIEW
          </Link>
          <button
            className="btn-term !px-2 !py-2 disabled:opacity-30"
            disabled={bitmap.status !== "for_sale"}
            onClick={() =>
              toast(`BITMAP #${bitmap.block_height}`, {
                description: "Settlement layer not connected in this prototype.",
              })
            }
          >
            BUY
          </button>
        </div>
      </div>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="label">{k}</dt>
      <dd className="truncate font-mono text-foreground">{v}</dd>
    </div>
  );
}
