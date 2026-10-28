import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { newBattleGame, type BattleGame } from "@/lib/highland-charge";
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
  const game = useRef<BattleGame>(newBattleGame()).current;
  const [hud, setHud] = useState<BattleGame>(() => ({ ...game }));
  const playing = focus != null && seats.some((s) => s.seat === focus);
  useEffect(() => {
    game.best = Number(localStorage.getItem("charge-best") ?? 0) || 0;
    const id = setInterval(() => {
      setHud({ ...game });
      localStorage.setItem("charge-best", String(game.best));
    }, 150);
    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); game.raise = true; }
    };
    window.addEventListener("keydown", key);
    return () => { clearInterval(id); window.removeEventListener("keydown", key); };
  }, [game]);
  const danger = hud.next && hud.next.in < 1.2 && hud.heroDownAt == null;
  return (
    <main className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      <ClientOnly fallback={null}>
        <Suspense fallback={null}><Charge seats={seats} focus={focus} game={game} /></Suspense>
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
      <div className="pointer-events-none absolute inset-x-0 top-36 z-10 p-4">
        <div className="pointer-events-auto mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded border border-border bg-background/85 p-3 font-mono text-xs">
          <span className="text-accent">STANDING {hud.standing}</span>
          <span className="text-destructive">FALLEN {hud.casualties}</span>
          {playing ? (
            <>
              <span className="text-foreground">BLOCKS {hud.blocks}</span>
              <span className="text-foreground">STREAK {hud.streak}</span>
              <span className="text-muted-foreground">BEST {hud.best}</span>
              <span className={danger ? "animate-pulse font-bold text-destructive" : "text-muted-foreground"}>
                {hud.heroDownAt != null ? "YOU FELL — RISE NEXT CHARGE" : hud.next ? `${hud.next.kind === "arrows" ? "ARROWS" : "CAVALRY"} IN ${Math.max(0, hud.next.in).toFixed(1)}s` : "HOLD THE LINE"}
              </span>
              {hud.last && <span className={hud.last === "BLOCKED" ? "text-accent" : "text-destructive"}>{hud.last}!</span>}
              <button
                onPointerDown={(e) => { e.preventDefault(); game.raise = true; }}
                disabled={!hud.shieldReady || hud.heroDownAt != null}
                className="ml-auto rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-40"
              >[SPACE] SHIELD</button>
            </>
          ) : (
            <span className="text-muted-foreground">Follow a soldier to fight: raise your shield as arrows land and the cavalry hits.</span>
          )}
        </div>
      </div>
    </main>
  );
}
