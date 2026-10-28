import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { listLaunchSeatsFn } from "@/lib/launch-seats.functions";

const Charge = lazy(() => import("@/components/launch/HighlandCharge3D"));
const seatsQuery = queryOptions({ queryKey: ["launch-seats"], queryFn: () => listLaunchSeatsFn(), staleTime: 15_000 });

export const Route = createFileRoute("/charge")({
  head: () => {
    const title = "The Highland Charge — every Bitmapper in one army · BITMAPWIN";
    const description = "Every seated Bitmapper becomes a soldier: Founders Row leads the charge, BITMAP holders carry orange flags.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(seatsQuery),
  component: ChargePage,
});

function ChargePage() {
  const { data } = useSuspenseQuery(seatsQuery);
  const seats = data.seats;
  const [input, setInput] = useState("");
  const [focus, setFocus] = useState<number | null>(null);
  const flags = seats.filter((s) => s.heldBitmap != null).length;
  return (
    <main className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      <ClientOnly fallback={null}>
        <Suspense fallback={null}><Charge seats={seats} focus={focus} /></Suspense>
      </ClientOnly>
      <div className="pointer-events-none absolute inset-x-0 top-0 p-4">
        <div className="pointer-events-auto mx-auto max-w-xl rounded border border-border bg-background/80 p-3 font-mono text-xs backdrop-blur">
          <h1 className="font-display text-lg text-foreground">THE HIGHLAND CHARGE</h1>
          <p className="text-muted-foreground">{seats.length} Bitmappers charge as one army · {flags} carry BITMAP flags · Founders Row in the front rank</p>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(input); setFocus(Number.isFinite(n) && n > 0 ? n : null); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Seat #" className="w-24 rounded border border-border bg-background px-2 py-1" />
            <button className="rounded bg-primary px-3 py-1 text-primary-foreground">FOLLOW MY SOLDIER</button>
            <Link to="/launch" className="ml-auto self-center text-accent">← GRANDSTAND</Link>
          </form>
        </div>
      </div>
    </main>
  );
}
