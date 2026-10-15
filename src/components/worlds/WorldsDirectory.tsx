import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { scanBitmapWorldsFn } from "@/lib/inscribed-world.functions";
import type { BitmapWorld } from "@/lib/inscribed-world.server";
import { InscribedWorldRunner } from "@/components/worlds/InscribedWorldRunner";
import { WorldIdRunner } from "@/components/worlds/BitmapWorldsPanel";

const BATCH = 12;

/** Scans the directory's BITMAPs on chain, 12 at a time, for inscribed 3D worlds. */
export function WorldsDirectory({ heights }: { heights: number[] }) {
  const scan = useServerFn(scanBitmapWorldsFn);
  const [found, setFound] = useState<Array<{ height: number; worlds: BitmapWorld[] }>>([]);
  const [scanned, setScanned] = useState(0);
  const [busy, setBusy] = useState(false);

  async function next() {
    const slice = heights.slice(scanned, scanned + BATCH);
    if (!slice.length) return;
    setBusy(true);
    try {
      const rows = await scan({ data: { heights: slice } });
      setFound((f) => [...f, ...rows]);
    } catch {
      /* keep what we have; the user can retry */
    } finally {
      setScanned((s) => s + slice.length);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (scanned === 0 && heights.length && !busy) void next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heights.length]);

  return (
    <div className="mt-3 space-y-4">
      <WorldIdRunner />
      <p className="label text-muted-foreground">
        {scanned.toLocaleString("en-US")} / {heights.length.toLocaleString("en-US")} BITMAPS SCANNED ON CHAIN · {found.reduce((s, r) => s + r.worlds.length, 0)} WORLDS
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {found.flatMap((row) =>
          row.worlds.map((w) => (
            <div key={w.inscriptionId} className="space-y-1">
              <Link to="/bitmap/$block" params={{ block: String(row.height) }} className="label text-bitcoin hover:underline">
                {row.height}.BITMAP · {w.source === "sat" ? "ON ITS SAT" : "CHILD"}
              </Link>
              <InscribedWorldRunner id={w.inscriptionId} engine={w.engine} title={w.title} description={w.description} backgroundId={w.backgroundId} height={360} />
            </div>
          )),
        )}
      </div>
      {scanned < heights.length ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={busy} onClick={next}>{busy ? "SCANNING…" : "SCAN NEXT 12 BITMAPS"}</Button>
        </div>
      ) : null}
    </div>
  );
}
