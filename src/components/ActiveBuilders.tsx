import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { activeBuildersQuery, shortAddr } from "@/lib/forge-builders";
import { BuilderAvatar } from "@/components/BuilderAvatar";

export function ActiveBuilders() {
  const { data = [], isLoading } = useQuery(activeBuildersQuery);
  return (
    <section className="mx-auto max-w-[1600px] px-3 pt-6 md:px-5 md:pt-10">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="label text-bitcoin">LIVE ON THE JUMBOTRON</div>
          <h2 className="display mt-2 text-2xl md:text-3xl">ACTIVE BUILDERS</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Makers whose pieces others build with. Each use pays them BIT, each inscription pays them sats.
          </p>
        </div>
        <Link to="/forge" className="btn-term">[ PUBLISH YOUR OWN PIECE ]</Link>
      </div>
      {data.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-6 font-mono text-[11px] text-signal">
          <span>{data.length} BUILDERS</span>
          <span>{data.reduce((n, b) => n + b.pieces, 0)} PIECES PUBLISHED</span>
          <span>{data.reduce((n, b) => n + b.uses, 0)} TIMES BUILT WITH</span>
        </div>
      )}
      {isLoading ? (
        <p className="mt-6 font-mono text-sm text-muted-foreground">&gt; LOADING BUILDERS<span className="blink">_</span></p>
      ) : data.length === 0 ? (
        <p className="mt-6 font-mono text-sm text-muted-foreground">&gt; NO PIECES PUBLISHED YET — BE THE FIRST BUILDER ON THE JUMBOTRON</p>
      ) : (
        <div className="mt-3 grid gap-px bg-border sm:grid-cols-2 md:mt-4 lg:grid-cols-4">
          {data.slice(0, 8).map((b, i) => (
            <div key={b.address} className="flex flex-col gap-2 bg-background p-3 md:gap-3 md:p-4">
              <div className="flex items-center gap-3">
                <BuilderAvatar address={b.address} size={44} />
                <div className="min-w-0">
                  <div className="label text-bitcoin">#{i + 1} BUILDER</div>
                  <div className="truncate font-mono text-sm" data-no-translate>{shortAddr(b.address)}</div>
                </div>
              </div>
              <div className="border-t border-border pt-2">
                <div className="label text-muted-foreground">NEWEST PIECE</div>
                <div className="truncate font-mono text-sm text-foreground" data-no-translate>{b.latest.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{b.latest.sphere.toUpperCase()} · {b.latest.blocks} BLOCKS</div>
              </div>
              <div className="flex gap-4 font-mono text-[10px] text-signal">
                <span>{b.pieces} PIECES</span><span>{b.uses} USES</span>
              </div>
              <Link to="/forge" className="btn-term-ghost text-center">[ BUILD WITH IT ]</Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
