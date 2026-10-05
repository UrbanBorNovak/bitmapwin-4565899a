import { Link } from "@tanstack/react-router";
import { RUNTIME_LIMITS } from "@/lib/extender-sdk";
import { EPOCH_ERAS, type EpochEra, type HolderEpoch } from "@/lib/holder-epoch";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Holder Epoch Score: on-chain holding time weighted by inscription era. */
export function PassportEpoch({ epoch, wallet }: { epoch: HolderEpoch | null | undefined; wallet: string | null }) {
  if (!wallet) return null;
  if (!epoch) {
    return <section className="passport-panel mt-8 p-4"><p className="passport-kicker">05 / HOLDER EPOCH</p><p className="passport-empty">&gt; NO INDEXED BITMAPS IN THE VERIFIED WALLET YET_</p></section>;
  }
  const progress = epoch.nextAt ? Math.min(100, (epoch.score / epoch.nextAt) * 100) : 100;
  return (
    <section className="passport-panel mt-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--passport-line)] p-4">
        <div>
          <p className="passport-kicker">05 / ARCHAEOLOGICAL CUSTODY</p>
          <h2 className="mt-2 font-mono text-2xl font-bold uppercase text-[var(--passport-paper)]">HOLDER EPOCH</h2>
          <p className="passport-copy mt-1">Blocks your BITMAPs have stayed in this wallet, weighted by the era they were inscribed. Free, read-only — selling resets a BITMAP's count.</p>
        </div>
        <div className="text-right" data-no-translate>
          <p className="font-mono text-4xl font-bold text-[var(--passport-gold)]">{fmt(epoch.score)}</p>
          <p className="passport-kicker">TIER {epoch.tier} · {epoch.title}</p>
        </div>
      </header>
      <div className="p-4">
        <div className="h-1 w-full bg-[var(--passport-line)]"><div className="h-1 bg-[var(--passport-gold)]" style={{ width: `${progress}%` }} /></div>
        <p className="mt-2 font-mono text-[10px] text-[var(--passport-muted)]">{epoch.nextAt ? `${fmt(epoch.nextAt - epoch.score)} POINTS TO NEXT TIER` : "HIGHEST TIER REACHED"} · TIP {fmt(epoch.tip)}</p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-[var(--passport-line)] md:grid-cols-4">
        {(Object.keys(EPOCH_ERAS) as EpochEra[]).map((era) => (
          <div key={era} className="bg-[var(--passport-panel)] p-3">
            <strong className="passport-value block">{epoch.eras[era]}</strong>
            <span className="passport-kicker text-[7px]">{EPOCH_ERAS[era].label} · ×{EPOCH_ERAS[era].multiplier}</span>
            <p className="font-mono text-[9px] text-[var(--passport-muted)]">GENESIS {EPOCH_ERAS[era].range}</p>
          </div>
        ))}
      </div>
      {epoch.longest ? (
        <p className="border-t border-[var(--passport-line)] p-4 font-mono text-xs text-[var(--passport-paper)]">
          LONGEST HELD: <Link to="/bitmap/$block" params={{ block: String(epoch.longest.height) }} className="text-[var(--passport-gold)]">{epoch.longest.height}.BITMAP</Link> · {fmt(epoch.longest.blocksHeld)} BLOCKS {epoch.longest.traced ? "SINCE TRACED PURCHASE" : "SINCE INSCRIPTION (NO TRACED SALE)"}
        </p>
      ) : null}
      <div className="border-t border-[var(--passport-line)]">
        <div className="hidden grid-cols-[1.2fr_1.6fr_0.9fr_0.7fr_0.8fr_0.7fr] gap-3 border-b border-[var(--passport-line)] px-4 py-2 md:grid">
          {["BITMAP", "ERA · HELD", "LAND BOOST", "VISITOR BIT", "BUILD HEIGHT", "EPOCH"].map((h) => <span key={h} className="passport-kicker text-[7px]">{h}</span>)}
        </div>
        {epoch.lands.slice(0, 12).map((l) => (
          <div key={l.height} className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-[var(--passport-line)] px-4 py-2 font-mono text-[11px] last:border-b-0 md:grid-cols-[1.2fr_1.6fr_0.9fr_0.7fr_0.8fr_0.7fr] md:items-center" data-no-translate>
            <Link to="/bitmap/$block" params={{ block: String(l.height) }} className="text-[var(--passport-paper)] hover:text-[var(--passport-gold)]">{l.height}.BITMAP</Link>
            <span className="text-[var(--passport-muted)]">{EPOCH_ERAS[l.era].label} · {fmt(l.blocksHeld)} BLK{l.traced ? "" : " *"}</span>
            <span className="text-[var(--signal)]">{l.boost?.label ?? "—"}</span>
            <span className="text-[var(--passport-paper)]">{l.boost ? `×${l.boost.dividend}` : "—"}</span>
            <span className="text-[var(--passport-paper)]">{l.boost ? `${RUNTIME_LIMITS.maxHeight + l.boost.heightBonus}${l.boost.heightBonus ? ` (+${l.boost.heightBonus})` : ""}` : "—"}</span>
            <span className="text-[var(--passport-gold)]">+{fmt(l.points)}</span>
          </div>
        ))}
        <p className="px-4 py-2 font-mono text-[9px] text-[var(--passport-muted)]">* No traced sale into this wallet — counted from inscription block. Land boost resets on any traced sale; visitor BIT multiplies the daily attention dividend, build height is the Extender ceiling in the Oasis.</p>
      </div>
    </section>
  );
}
