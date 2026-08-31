import { Link } from "@tanstack/react-router";
import { BlockMosaic } from "@/components/BlockMosaic";
import { formatBytes, shortId, timeAgoFromUnix, type ChainBlock } from "@/lib/chain";
import { rarityOf, traitsOf } from "@/lib/traits";

const STATUS_LABEL: Record<ChainBlock["bitmapStatus"], string> = {
  valid: "VALID BITMAP",
  unclaimed: "UNCLAIMED",
  unknown: "UNVERIFIED",
};

export function ChainBlockCard({ block }: { block: ChainBlock }) {
  const count = block.inscriptionCount;
  const countLabel = `${count}${block.inscriptionCountIsMinimum ? "+" : ""}`;
  const status = block.bitmapStatus;
  const otherClaims = block.bitmapClaims.filter((c) => c.claimedHeight !== block.height);
  const traits = traitsOf(block.height);
  const rarity = rarityOf(block.height);

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
        <div className="flex items-start justify-between gap-2">
          <div className="display text-sm">{block.height}.bitmap</div>
          <span
            className={
              status === "valid"
                ? "border border-foreground bg-foreground px-1.5 py-0.5 font-mono text-[9px] text-background"
                : "border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
            }
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className="label mt-1">{timeAgoFromUnix(block.timestamp)}</div>

        <dl className="mt-3 space-y-1 text-[11px]">
          <Row k="INSCRIPTIONS" v={countLabel} />
          <Row k="TXS" v={block.txCount.toLocaleString("en-US")} />
          <Row k="SIZE" v={formatBytes(block.size)} />
          <Row k="MINER" v={block.miner ?? "—"} />
          <Row k="HASH" v={shortId(block.hash)} />
        </dl>

        {status === "valid" && block.bitmapInscriptionId && (
          <div className="mt-3 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
            <div className="label">FIRST TXT INSCRIPTION</div>
            <a
              href={`https://ordinals.com/inscription/${block.bitmapInscriptionId}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-foreground hover:underline"
            >
              &gt; {shortId(block.bitmapInscriptionId)}
            </a>
            <div className="mt-1">
              INSCRIBED IN BLOCK {block.bitmapInscribedInBlock}
              {block.bitmapInscribedInBlock === block.height ? " (SAME BLOCK)" : ""}
            </div>
          </div>
        )}

        {otherClaims.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
            <li className="label">CLAIMS IN THIS BLOCK</li>
            {otherClaims.slice(0, 4).map((c) => (
              <li key={c.inscriptionId} className="truncate">
                &gt; {c.claimedHeight}.bitmap{" "}
                {c.valid === true ? "· VALID" : c.valid === false ? "· INVALID (DUPLICATE)" : "· UNVERIFIED"}
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
