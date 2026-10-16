import { useQuery } from "@tanstack/react-query";
import { traitsOf } from "@/lib/traits";
import { satRarity, satSpecials, satToBlock } from "@/lib/sat-rarity";
import { satProofQuery } from "@/lib/sat-lookup";
import { hybridTributes } from "@/lib/hybrid-tributes";

/** Blocktributes (height) + Satributes (OCI sat) + hybrids, with OCI proof. */
export function TributesPanel({ height }: { height: number }) {
  const traits = traitsOf(height);
  const { data: proof, isLoading } = useQuery(satProofQuery(height));
  const sat = proof?.sat ?? null;
  const mined = sat !== null ? satToBlock(sat) : null;
  const specials = sat !== null ? satSpecials(sat) : [];
  const hybrids = sat !== null ? hybridTributes(height, sat) : [];

  return (
    <section className="border border-border bg-card/60 backdrop-blur-sm">
      <h2 className="label border-b border-border px-4 py-3">BLOCKTRIBUTES & SATRIBUTES</h2>
      <div className="grid gap-px bg-border md:grid-cols-2">
        <div className="bg-card p-4">
          <p className="label text-bitcoin">BLOCKTRIBUTES</p>
          {traits.length ? (
            <ul className="mt-2 flex flex-wrap gap-1">
              {traits.map((t) => (
                <li key={t.id} title={t.description} className={`border px-1.5 py-0.5 font-mono text-[10px] ${t.rare ? "border-foreground" : "border-border text-muted-foreground"}`}>{t.label}</li>
              ))}
            </ul>
          ) : <p className="mt-2 font-mono text-[11px] text-muted-foreground">NO HEIGHT TRAITS</p>}
        </div>
        <div className="bg-card p-4">
          <p className="label text-signal">SATRIBUTES</p>
          {isLoading ? <p className="mt-2 font-mono text-[11px] text-muted-foreground">READING ON-CHAIN INDEX…</p>
            : sat === null || !mined ? <p className="mt-2 font-mono text-[11px] text-muted-foreground">SAT NOT RESOLVED</p>
            : (
              <>
                <ul className="mt-2 flex flex-wrap gap-1">
                  <li className="border border-signal px-1.5 py-0.5 font-mono text-[10px] text-signal">{satRarity(sat)} SAT</li>
                  {specials.map((s) => <li key={s.id} title={s.note} className="border border-border px-1.5 py-0.5 font-mono text-[10px]">{s.label}</li>)}
                </ul>
                <dl className="mt-3 space-y-1 font-mono text-[11px]" data-no-translate>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">SAT</dt>
                    <dd><a className="hover:text-signal" target="_blank" rel="noreferrer" href={`https://ordinals.com/sat/${sat}`}>{sat.toLocaleString("en-US")} ↗</a></dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">MINED IN</dt><dd>BLOCK {mined.height.toLocaleString("en-US")} · OFFSET {mined.offset.toLocaleString("en-US")}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">EPOCH</dt><dd>{Math.floor(mined.height / 210_000)}</dd></div>
                </dl>
              </>
            )}
        </div>
      </div>
      {hybrids.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="label text-signal">HYBRID</p>
          <ul className="mt-2 flex flex-wrap gap-1">
            {hybrids.map((h) => <li key={h.id} title={h.note} className="border border-signal bg-signal/10 px-1.5 py-0.5 font-mono text-[10px] text-signal">{h.label}</li>)}
          </ul>
        </div>
      )}
      {proof && (
        <p className="border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground" data-no-translate>
          PROOF · {proof.source === "LIVEOCI" ? `LIVEOCI V1.1 PAGE ${proof.page} · /r/sat/${proof.sat}/at/${proof.at}` : "BITMAP INDEX"}
        </p>
      )}
    </section>
  );
}
