import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ATLAS_SIDE, blockToAtlas } from "@/lib/atlas-geometry";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { TRIBUTE_SATS } from "@/lib/guardian-delegate";

/**
 * Interactive explainer: Bitcoin L1 at the base, the Ordinals inscription layer
 * on top, BITMAP land on top of that — and on the side, Digital Matter Theory
 * (DMT), which reads non-arbitrary data straight out of each block.
 * Live Guardian summons make the route from a Bitcoin transaction into DMT
 * traits and its exact Hilbert-mapped BITMAP position inspectable.
 */

type LayerId = "bitcoin" | "ordinals" | "bitmap" | "dmt";

const LAYERS: Record<LayerId, { tag: string; title: string; line: string; facts: string[]; here: string }> = {
  bitmap: {
    tag: "L3 · LAND",
    title: "BITMAP",
    line: "<HEIGHT>.BITMAP — ONE BLOCK, ONE PIECE OF LAND",
    facts: [
      "THE TEXT <height>.bitmap IS INSCRIBED ON A SAT",
      "FIRST-IS-FIRST: THE EARLIEST VALID INSCRIPTION OF A HEIGHT IS THE DEED",
      "THE BLOCK'S TRANSACTIONS BECOME ITS PARCELS (<index>.<height>.bitmap)",
      "OWNERSHIP = WHOEVER HOLDS THAT SAT",
    ],
    here: "MAP, OASIS TERRITORY, DISTRICTS, EXTENDERS, MARKETPLACE",
  },
  ordinals: {
    tag: "L2 · INSCRIPTIONS",
    title: "ORDINALS",
    line: "NUMBER EVERY SAT · WRITE DATA INTO THE WITNESS",
    facts: [
      "ORDINAL THEORY GIVES EVERY SATOSHI A SERIAL NUMBER",
      "DATA SITS IN A TAPROOT WITNESS ENVELOPE (OP_FALSE OP_IF … OP_ENDIF)",
      "TAGS ADD META: PARENT (TAG 3), DELEGATE (TAG 11), CONTENT-ENCODING",
      "PROTOCOL RULES ARE INDEXER CONVENTION — BITCOIN ITSELF DOESN'T ENFORCE THEM",
    ],
    here: "BLOCK-DNA GUARDIAN CHILDREN, ON-CHAIN 3D MODELS, MASTER GENERATOR",
  },
  bitcoin: {
    tag: "L1 · BASE CHAIN",
    title: "BITCOIN",
    line: "PROOF-OF-WORK · BLOCKS EVERY ~10 MIN · UTXOS",
    facts: [
      "EACH BLOCK HEADER: PREV HASH, MERKLE ROOT, TIME, BITS, NONCE",
      "SHA-256 PROOF OF WORK ORDERS HISTORY — NOBODY CAN REWRITE IT CHEAPLY",
      "UTXOS CARRY THE SATS (AND SO THE INSCRIPTIONS) BETWEEN OWNERS",
      "21M CAP · HALVING EVERY 210,000 BLOCKS",
    ],
    here: "BLOCK HEIGHTS, HASHES, TX COUNTS AND FEES FEED EVERYTHING ABOVE",
  },
  dmt: {
    tag: "SIDE WING · DMT",
    title: "DIGITAL MATTER THEORY",
    line: "VALUE READ FROM THE BLOCK ITSELF, NOT INVENTED",
    facts: [
      "NON-ARBITRARY: TRAITS COME FROM BLOCK FIELDS (HASH, NONCE, BITS, SIZE, TX COUNT)",
      "AN ELEMENT INSCRIPTION NAMES WHICH FIELD TO READ — ANYONE CAN RECOMPUTE IT",
      "BITMAP IS THE ORIGINAL DIGITAL MATTER: THE BLOCK IS THE ASSET",
      "TRUE BLOCK ASSETS: SAME BLOCK → SAME RESULT, ON ANY INDEXER",
    ],
    here: "BLOCK-DNA GUARDIANS (SPECIES / STATS FROM THE HASH), BLOCK TRAITS, PATOSHI, MOSAICS",
  },
};

const STACK: LayerId[] = ["bitmap", "ordinals", "bitcoin"];

const HILBERT_POINTS = Array.from({ length: 1024 }, (_, index) => {
  const point = blockToAtlas(index * 1024);
  return `${((point.x + 0.5) / ATLAS_SIDE) * 100},${((point.y + 0.5) / ATLAS_SIDE) * 100}`;
}).join(" ");

function compactTxid(txid: string) {
  return `${txid.slice(0, 8)}…${txid.slice(-8)}`;
}

export function ChainStackInfographic() {
  const [active, setActive] = useState<LayerId>("bitmap");
  const [guardianIndex, setGuardianIndex] = useState(0);
  const { data: guardians = [], isLoading } = useQuery({
    ...allGuardiansQuery(),
    refetchInterval: 15_000,
  });
  const guardian = guardians[guardianIndex % Math.max(guardians.length, 1)] ?? null;
  const atlasPoint = useMemo(() => (guardian ? blockToAtlas(guardian.height) : null), [guardian]);
  const a = LAYERS[active];

  const layerBtn = (id: LayerId, extra = "") => {
    const l = LAYERS[id];
    const on = active === id;
    return (
      <Button
        key={id}
        type="button"
        variant="ghost"
        onClick={() => setActive(id)}
        onMouseEnter={() => setActive(id)}
        aria-pressed={on}
        className={`group relative h-auto w-full items-stretch overflow-hidden border p-4 text-left whitespace-normal transition-colors ${
          on ? "border-bitcoin bg-background" : "border-border bg-background/60 hover:border-foreground"
        } ${extra}`}
      >
        <div className="w-full">
          <div className={`label ${id === "dmt" ? "text-signal" : "text-bitcoin"}`}>{l.tag}</div>
          <div className="display mt-1 text-base md:text-lg">{l.title}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{l.line}</div>
          <div className="mt-3 h-px overflow-hidden bg-border">
            <div className={`infogfx-sweep h-full ${id === "dmt" ? "bg-signal" : "bg-bitcoin"}`} />
          </div>
        </div>
      </Button>
    );
  };

  return (
    <figure className="infogfx border border-border bg-surface">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="label text-bitcoin">THE BITCOIN LAND STACK</span>
        <span className="label text-muted-foreground">TAP A LAYER TO INSPECT</span>
      </figcaption>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        {/* stack + side wing */}
        <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,0.85fr)] items-stretch gap-0">
          <div className="flex flex-col gap-1">
            {STACK.map((id, i) => (
              <div key={id} className="flex flex-col">
                {layerBtn(id, id === "bitcoin" ? "border-b-2" : "")}
                {i < STACK.length - 1 ? (
                  <div className="flex items-center justify-center py-1" aria-hidden="true">
                    <div className="relative h-4 w-px bg-border">
                      <span className="infogfx-runner absolute -left-[3px] h-[7px] w-[7px] bg-bitcoin" />
                    </div>
                    <span className="label ml-2 text-muted-foreground">{i === 0 ? "BUILT ON" : "WRITTEN INTO"}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* conduit from L1 to DMT */}
          <div className="relative" aria-hidden="true">
            <div className="absolute bottom-10 left-1/2 top-10 w-px -translate-x-1/2 bg-signal/40" />
            <div className="absolute bottom-10 left-0 right-0 h-px bg-signal/60" />
            <span className="infogfx-runner absolute bottom-[38px] left-0 h-[5px] w-[5px] bg-signal" />
          </div>

          <div className="flex flex-col justify-end">
            <div className="label mb-2 text-signal">READS RAW BLOCK DATA ↓</div>
            {layerBtn("dmt", "flex-1 border-dashed")}
            <div className="mt-2 grid grid-cols-3 gap-px border border-border bg-border font-mono text-[9px]">
              {["HASH", "NONCE", "BITS", "SIZE", "TX#", "TIME"].map((f) => (
                <span key={f} className="bg-background px-1 py-1 text-center text-muted-foreground">{f}</span>
              ))}
            </div>
          </div>
        </div>

        {/* inspector */}
        <div className="border border-border bg-background p-4" aria-live="polite">
          <div className={`label ${active === "dmt" ? "text-signal" : "text-bitcoin"}`}>{a.tag}</div>
          <div className="display mt-1 text-xl">{a.title}</div>
          <ul className="mt-3 space-y-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {a.facts.map((f) => (
              <li key={f} className="flex gap-2">
                <span className={active === "dmt" ? "text-signal" : "text-bitcoin"}>›</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-3">
            <div className="label text-muted-foreground">ON BITMAPWIN</div>
            <p className="mt-1 font-mono text-[11px] text-foreground">{a.here}</p>
          </div>
        </div>
      </div>

      <div className="grid border-t border-border lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <section className="border-b border-border p-4 lg:border-r lg:border-b-0" aria-label="Live Guardian summon transaction">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label text-bitcoin">LIVE PROOF ROUTE · 15S</div>
              <h3 className="display mt-1 text-base">SUMMON FEE ON BITCOIN</h3>
            </div>
            {guardians.length > 1 ? (
              <div className="flex gap-1">
                <Button size="icon" variant="terminalGhost" aria-label="Previous confirmed summon" onClick={() => setGuardianIndex((value) => (value - 1 + guardians.length) % guardians.length)}><ChevronLeft /></Button>
                <Button size="icon" variant="terminalGhost" aria-label="Next confirmed summon" onClick={() => setGuardianIndex((value) => (value + 1) % guardians.length)}><ChevronRight /></Button>
              </div>
            ) : null}
          </div>

          {guardian ? (
            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 font-mono text-[10px]">
              <div className="border border-signal bg-signal/10 px-2 py-3 text-signal">TX</div>
              <div className="relative h-px bg-signal/40"><span className="infogfx-runner absolute -top-[3px] size-[7px] bg-signal" /></div>
              <div className="border border-bitcoin bg-bitcoin/10 px-2 py-3 text-center text-bitcoin">{TRIBUTE_SATS.toLocaleString()} SATS</div>
              <div className="relative h-px bg-bitcoin/40"><span className="infogfx-runner absolute -top-[3px] size-[7px] bg-bitcoin" /></div>
              <div className="border border-bitcoin bg-bitcoin/10 px-2 py-3 text-bitcoin">AWAKE</div>
            </div>
          ) : null}

          <div className="mt-3 border border-border bg-background p-3 font-mono text-[10px]">
            {guardian ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <span><span className="text-muted-foreground">BITMAP</span> <span className="text-foreground">{guardian.height}.BITMAP</span></span>
                <span><span className="text-muted-foreground">GUARDIAN</span> <span className="text-foreground">{guardian.species}</span></span>
                <span><span className="text-muted-foreground">RARITY</span> <span className="text-signal">{guardian.rarity}</span></span>
                <a className="inline-flex items-center gap-1 text-bitcoin hover:text-foreground" href={`https://mempool.space/tx/${guardian.txid}`} target="_blank" rel="noreferrer" data-no-translate>
                  TX {compactTxid(guardian.txid)} <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <span className="text-muted-foreground">{isLoading ? "READING CONFIRMED SUMMONS…" : "NO CONFIRMED SUMMON TRANSACTION YET"}</span>
            )}
          </div>
          <p className="label mt-2 text-muted-foreground">THE DISPLAYED FEE IS LINKED TO THE RECORDED PAYMENT TRANSACTION · NEVER SIMULATED</p>
        </section>

        <section className="p-4" aria-label="Hilbert curve BITMAP mapping">
          <div className="label text-signal">ORDER-10 HILBERT ATLAS · 1,048,576 CELLS</div>
          <h3 className="display mt-1 text-base">BLOCK → BITMAP COORDINATE</h3>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_112px] gap-4">
            <div className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              <p>BLOCK HEIGHT IS THE HILBERT DISTANCE. THE CURVE KEEPS CONSECUTIVE BLOCKS BESIDE EACH OTHER WHILE FILLING THE ATLAS.</p>
              <div className="mt-3 border-l border-signal pl-3 text-foreground">
                <div>HEIGHT <span className="text-signal">{guardian?.height.toLocaleString() ?? "—"}</span></div>
                <div>CELL X <span className="text-signal">{atlasPoint?.x ?? "—"}</span> · Y <span className="text-signal">{atlasPoint?.y ?? "—"}</span></div>
                <div>TX INDEX → <span className="text-bitcoin">PARCEL INDEX</span></div>
              </div>
            </div>
            <svg viewBox="0 0 100 100" className="aspect-square w-full border border-border bg-background" role="img" aria-label={guardian ? `${guardian.height}.BITMAP mapped on the Hilbert atlas` : "Hilbert atlas mapping"}>
              <polyline points={HILBERT_POINTS} fill="none" stroke="currentColor" strokeWidth="0.42" className="infogfx-hilbert text-signal opacity-55" vectorEffect="non-scaling-stroke" />
              {atlasPoint ? (
                <>
                  <line x1={(atlasPoint.x / ATLAS_SIDE) * 100} y1="0" x2={(atlasPoint.x / ATLAS_SIDE) * 100} y2="100" className="text-bitcoin" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 2" />
                  <line x1="0" y1={(atlasPoint.y / ATLAS_SIDE) * 100} x2="100" y2={(atlasPoint.y / ATLAS_SIDE) * 100} className="text-bitcoin" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 2" />
                  <rect x={(atlasPoint.x / ATLAS_SIDE) * 100 - 1.7} y={(atlasPoint.y / ATLAS_SIDE) * 100 - 1.7} width="3.4" height="3.4" className="fill-bitcoin infogfx-cell" />
                </>
              ) : null}
            </svg>
          </div>
        </section>
      </div>

      <p className="label border-t border-border px-4 py-2 text-muted-foreground">
        BITCOIN SECURES IT · ORDINALS RECORDS IT · BITMAP MAPS IT · DMT READS IT
      </p>
    </figure>
  );
}
