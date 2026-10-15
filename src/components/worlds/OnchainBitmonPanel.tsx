import { useState } from "react";

/** bop's on-chain Bitmon pattern module (#73661860) and viewer (#76176391), data by @bitlodo. */
export const BITMON_MODULE_ID = "55551557695dd82a2bda5ec3497684ec7cbb2cc1752ff5101accff1648666c3ai0";
export const BITMON_VIEWER_ID = "78387255f667a67add30b3c7a65c3e35894e353e802dc19cfcb76adbae490acai0";

export function OnchainBitmonPanel({ height }: { height: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-md border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="label text-accent">ON-CHAIN BITMON PATTERN · EXPERIMENTAL</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The shape of {height}.BITMAP, read from an inscribed pattern module. Module by @boppleton, data by @bitlodo.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary/10">
          {open ? "CLOSE VIEWER" : "OPEN ON-CHAIN VIEWER"}
        </button>
      </div>
      {open && (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded border border-border">
          <iframe
            title={`Bitmon pattern ${height}`}
            src={`https://ordinals.com/content/${BITMON_VIEWER_ID}#${height}`}
            sandbox="allow-scripts"
            className="h-full w-full"
            loading="lazy"
          />
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        Enter {height} in the viewer.{" "}
        <a className="underline" href={`https://ordinals.com/content/${BITMON_MODULE_ID}`} target="_blank" rel="noreferrer">MODULE #73661860</a>{" · "}
        <a className="underline" href="https://ordinals.com/inscription/76176391" target="_blank" rel="noreferrer">VIEWER #76176391</a>{" · "}
        <a className="underline" href="https://bitlords.land/bitmon" target="_blank" rel="noreferrer">BITLORDS.LAND</a>
      </p>
    </section>
  );
}
