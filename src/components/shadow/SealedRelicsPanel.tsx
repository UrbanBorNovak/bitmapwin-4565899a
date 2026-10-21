import { Link } from "@tanstack/react-router";
import { keycardDenial, relicStateLabel, relicStore, unlocks, useSealedRelics } from "@/lib/sealed-relics";

/** Sealed vault notes that are Biternam relics or Shadow Gate keycards. */
export function SealedRelicsPanel({ compact = false }: { compact?: boolean }) {
  const relics = useSealedRelics();
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] tracking-widest text-signal">SEALED RELICS</div>
        <button type="button" onClick={() => void relicStore.refresh(true)} className="text-[10px] text-muted-foreground">[ RECHECK ]</button>
      </div>
      {relics.length ? (
        <ul className="mt-1 space-y-1">
          {relics.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 text-[11px]" title={r.item?.blurb}>
              <span className="text-foreground">
                <span className="mr-1 text-primary">{r.item?.icon ?? "⚷"}</span>
                {r.kind.type === "keycard" ? `KEYCARD · ${r.kind.slug}` : r.item?.name ?? r.label}
              </span>
              <span className={unlocks(r.state) ? "text-signal" : "text-primary"}>{relicStateLabel(r.state)}</span>
              {r.kind.type === "keycard" && !unlocks(r.state) ? (() => { const d = keycardDenial([r], r.kind.slug); return d ? <span className="w-full text-[10px] text-muted-foreground">{d.reason} Next: {d.next}</span> : null; })() : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          None yet. {compact ? "" : "Seal a wrist item or a gate pass onto a Bitcoin coin to make it giftable."} <Link to="/vault" className="text-primary">Open the vault</Link>
        </p>
      )}
    </div>
  );
}
