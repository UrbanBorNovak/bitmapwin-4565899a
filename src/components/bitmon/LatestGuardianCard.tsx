import { lazy, Suspense } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery } from "@/lib/bitmon-queries";

const Territory3D = lazy(() => import("@/components/BitmapTerritory3D"));

/** Most recently minted Guardian, standing on its own BITMAP's real parcels. */
export function LatestGuardianCard() {
  const q = useQuery({ ...allGuardiansQuery(), refetchInterval: 15_000 });
  const g = q.data?.[0];
  if (!g) return null;
  const box = <div className="aspect-square w-full border border-border bg-background" />;
  return (
    <Link to="/bitmap/$block" params={{ block: String(g.height) }} className="mt-3 block border border-border bg-background p-3 hover:border-foreground">
      <ClientOnly fallback={box}>
        <Suspense fallback={box}>
          <Territory3D height={g.height} guardian={g} />
        </Suspense>
      </ClientOnly>
      <div className="label mt-3 flex items-center gap-2 text-signal">
        <span className="size-1.5 bg-signal" aria-hidden="true" />
        LATEST GUARDIAN MINTED
      </div>
      <div className="display mt-1 truncate text-sm">{g.species} · {g.height}.BITMAP</div>
      <div className="mt-1 font-mono text-[10px] text-muted-foreground">{g.rarity} · {new Date(g.createdAt).toLocaleString()}</div>
    </Link>
  );
}
