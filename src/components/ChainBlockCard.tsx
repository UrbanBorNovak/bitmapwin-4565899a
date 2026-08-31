import { Link } from "@tanstack/react-router";
import { BitmapPixelMap } from "@/components/BitmapPixelMap";
import { formatBytes, shortId, timeAgoFromUnix, type ChainBlock } from "@/lib/chain";

export function ChainBlockCard({ block }: { block: ChainBlock }) {
  const count = block.inscriptionCount;
  const countLabel = `${count}${block.inscriptionCountIsMinimum ? "+" : ""}`;

  return (
    <article className="group border border-border bg-card transition-[border-color,transform] duration-150 hover:border-foreground hover:-translate-y-0.5">
      <Link
        to="/bitmap/$block"
        params={{ block: String(block.height) }}
        className="block border-b border-border p-4"
      >
        <BitmapPixelMap blockHeight={block.height} txCount={block.txCount} />
      </Link>

      <div className="p-3">
        <div className="display text-sm">{block.height}.bitmap</div>
        <div className="label mt-1">{timeAgoFromUnix(block.timestamp)}</div>

        <dl className="mt-3 space-y-1 text-[11px]">
          <Row k="INSCRIPTIONS" v={countLabel} />
          <Row k="TXS" v={block.txCount.toLocaleString("en-US")} />
          <Row k="SIZE" v={formatBytes(block.size)} />
          <Row k="MINER" v={block.miner ?? "—"} />
          <Row k="HASH" v={shortId(block.hash)} />
        </dl>

        {block.sampleInscriptions.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
            {block.sampleInscriptions.map((id) => (
              <li key={id} className="truncate">
                <a
                  href={`https://ordinals.com/inscription/${id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground hover:underline"
                >
                  &gt; {shortId(id)}
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/bitmap/$block"
            params={{ block: String(block.height) }}
            className="btn-term-ghost !px-2 !py-2"
          >
            VIEW
          </Link>
          <a
            href={`https://mempool.space/block/${block.hash}`}
            target="_blank"
            rel="noreferrer"
            className="btn-term !px-2 !py-2 text-center"
          >
            CHAIN
          </a>
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
