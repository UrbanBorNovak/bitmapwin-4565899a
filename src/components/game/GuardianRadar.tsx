/** AWAKENED GUARDIANS radar — the same list as the Bestiary, with one-click warp to each home BITMAP. */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery } from "@/lib/bitmon-queries";

export function GuardianRadar({ current }: { current?: number }) {
  const { data } = useQuery(allGuardiansQuery());
  const list = [...(data ?? [])].sort((a, b) =>
    current == null ? a.height - b.height : Math.abs(a.height - current) - Math.abs(b.height - current),
  );
  return (
    <details className="mt-3 border border-border bg-card p-4" open>
      <summary className="label cursor-pointer text-signal">● AWAKENED GUARDIANS · {list.length}</summary>
      {list.length === 0 ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">NO GUARDIANS AWAKE YET</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => (
            <li key={g.height} className="flex items-center justify-between gap-2 border border-border px-2 py-1.5 font-mono text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: g.accent }} />
                <span className="truncate">{g.species} · <span className="text-bitcoin">{g.height}.BITMAP</span></span>
              </span>
              <span className="flex shrink-0 gap-2">
                {g.inscriptionId ? <Link to="/breed" search={{ sire: g.height }} className="label text-signal hover:text-foreground">[BREED]</Link> : null}
                {current === g.height ? (
                  <span className="label text-signal">HERE</span>
                ) : (
                  <Link to="/oasis" search={{ height: g.height }} className="label text-bitcoin hover:text-foreground">[WARP]</Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
