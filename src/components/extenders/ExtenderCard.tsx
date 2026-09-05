import { Link } from "@tanstack/react-router";
import { categoryGlyph, categoryLabel, type Extender, type ExtenderStats } from "@/lib/extenders";
import { shortenAddress } from "@/lib/registry";
import { formatBit } from "@/lib/coins";

export function ExtenderCard({ extender, stats }: { extender: Extender; stats?: ExtenderStats | undefined }) {
  return (
    <Link
      to="/extenders/$slug"
      params={{ slug: extender.slug }}
      className="group flex flex-col border border-border bg-surface p-4 transition-colors hover:border-bitcoin"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="label flex items-center gap-2 text-bitcoin">
          <span aria-hidden="true">{categoryGlyph(extender.category)}</span>
          {categoryLabel(extender.category)}
        </div>
        {extender.isAiBuilt ? <span className="label border border-bitcoin px-1.5 py-0.5 text-bitcoin">AI BUILT</span> : null}
      </div>

      <div className="display mt-3 text-lg group-hover:text-bitcoin">{extender.name}</div>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {extender.summary || "NO SUMMARY PROVIDED"}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 font-mono text-[10px]">
        <div>
          <dt className="text-muted-foreground">VERSIONS</dt>
          <dd className="text-foreground" data-no-translate>{stats?.publishedVersions ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">DEPLOYED</dt>
          <dd className="text-foreground" data-no-translate>{stats?.activeDeployments ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">PRICE</dt>
          <dd className="text-foreground" data-no-translate>
            {extender.monetization === "free" || extender.priceBit <= 0 ? "FREE" : formatBit(extender.priceBit)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 font-mono text-[10px] text-muted-foreground" data-no-translate>
        BY {extender.creatorAddress ? shortenAddress(extender.creatorAddress) : "UNLINKED BUILDER"}
      </div>
    </Link>
  );
}
