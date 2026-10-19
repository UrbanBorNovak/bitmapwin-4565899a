import { Link } from "@tanstack/react-router";
import { OtherthingsBadge } from "@/components/OtherthingsBadge";

const BRANCHES = [
  { to: "/collections/guardians", label: "GUARDIANS", note: "One per block, from block DNA" },
  { to: "/explore", label: "LAND", note: "Every BITMAP by block height — Bedrock + LiveOCI" },
  { to: "/builds", label: "FORGE BUILDS", note: "Voxel builds inscribed on land" },
  { to: "/breed", label: "PETS", note: "Bred from two inscribed Guardians" },
] as const;

/**
 * THE OTHERTHINGS family tree. This is a brand grouping, not an Ordinals
 * parent-child link: only a Tag 3 parent spent in the reveal makes a verified child.
 */
export function OtherthingsHierarchy({ compact = false }: { compact?: boolean }) {
  return (
    <section className="border border-border bg-surface p-4 md:p-5">
      <OtherthingsBadge child="Umbrella collection" />
      <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-2 md:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {BRANCHES.map((b) => (
          <Link key={b.label} to={b.to} className="border border-border bg-background/60 p-3 hover:border-primary">
            <div className="label text-[9px] text-muted-foreground">CHILD OF THE OTHERTHINGS</div>
            <div className="display mt-1 text-sm text-foreground">{b.label}</div>
            {!compact && <p className="mt-1 text-xs text-muted-foreground">{b.note}</p>}
          </Link>
        ))}
      </div>
      {!compact && (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="border border-bitcoin/60 bg-background/60 p-3">
            <div className="label text-[9px] text-bitcoin">UMBRELLA · MASTER INSCRIPTION</div>
            <div className="display mt-1 text-sm text-foreground">BITMAP</div>
            <p className="mt-1 text-xs text-muted-foreground">
              The protocol and master inscription everything grows from: one <span className="font-mono">&lt;height&gt;.bitmap</span> per Bitcoin block.
            </p>
          </div>
          <div className="border border-border bg-background/60 p-3">
            <div className="label text-[9px] text-muted-foreground">LAND · BEDROCK</div>
            <div className="display mt-1 text-sm text-foreground">BITMAP AS LAND</div>
            <p className="mt-1 text-xs text-muted-foreground">
              The permanent ground: fixed block grid, parcels split by transaction count, one owner per tile, full-height air rights. No landlord, no company server.
            </p>
          </div>
          <div className="border border-signal/60 bg-background/60 p-3">
            <div className="label text-[9px] text-signal">LAND · LIVEOCI</div>
            <div className="display mt-1 text-sm text-foreground">LIVE RESOLVER</div>
            <p className="mt-1 text-xs text-muted-foreground">
              The on-chain index covers blocks 0–969,999; newer blocks are read straight from Bitcoin so first-is-first ownership never depends on a third party.
            </p>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        This family is how we group things, not an on-chain link. A piece is only a verified on-chain child when its
        parent inscription was spent in the reveal (Tag 3). Inscription ids and existing parents stay unchanged.
      </p>
    </section>
  );
}
