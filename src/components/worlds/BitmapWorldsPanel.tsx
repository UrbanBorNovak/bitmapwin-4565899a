import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBitmapWorldsFn, inspectWorldFn } from "@/lib/inscribed-world.functions";
import { normalizeWorldId, type WorldInfo } from "@/lib/inscribed-world";
import { InscribedWorldRunner } from "@/components/worlds/InscribedWorldRunner";

/** BITMAP page: auto-detected inscribed 3D worlds, plus a paste-an-id test runner. */
export function BitmapWorldsPanel({ height }: { height: number }) {
  const worlds = useQuery({
    queryKey: ["bitmap-worlds", height],
    queryFn: () => getBitmapWorldsFn({ data: { height } }),
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const list = worlds.data ?? [];
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-signal" />
        <h2 className="label">INSCRIBED 3D WORLDS</h2>
        <span className="label text-muted-foreground">
          {worlds.isPending ? "SCANNING CHAIN…" : `${list.length} FOUND ON THIS BITMAP`}
        </span>
      </div>
      {list.map((w) => (
        <InscribedWorldRunner key={w.inscriptionId} id={w.inscriptionId} engine={w.engine} title={w.title} description={w.description} backgroundId={w.backgroundId} />
      ))}
      {!worlds.isPending && list.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">
          NO INSCRIBED.SPACE OR RECURSIVE 3D WORLD IS INSCRIBED AS A CHILD OR ON THE SAT OF {height}.BITMAP YET.
        </p>
      ) : null}
      <WorldIdRunner />
    </section>
  );
}

/** Paste any inscription id — runs it if its HTML is a 3D world. */
export function WorldIdRunner() {
  const inspect = useServerFn(inspectWorldFn);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [world, setWorld] = useState<(WorldInfo & { id: string }) | null>(null);

  async function check() {
    const id = normalizeWorldId(input);
    if (!id) return setError("PASTE A VALID INSCRIPTION ID OR ORDINALS URL");
    setBusy(true); setError(null); setWorld(null);
    try {
      const info = await inspect({ data: { id } });
      if (info) setWorld({ ...info, id });
      else setError("THAT INSCRIPTION IS NOT A RECOGNISED 3D WORLD");
    } catch {
      setError("COULD NOT READ THAT INSCRIPTION RIGHT NOW");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="RUN ANY WORLD — PASTE INSCRIPTION ID…"
          className="h-9 min-w-0 flex-1 border border-border bg-background px-3 font-mono text-xs"
        />
        <Button type="button" size="sm" className="h-9" disabled={busy} onClick={check}>{busy ? "READING…" : "LOAD"}</Button>
      </div>
      {error ? <p className="label text-destructive">{error}</p> : null}
      {world ? <InscribedWorldRunner id={world.id} engine={world.engine} title={world.title} description={world.description} backgroundId={world.backgroundId} /> : null}
    </div>
  );
}
