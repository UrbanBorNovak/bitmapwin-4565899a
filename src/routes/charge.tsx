import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { newBattleGame, type BattleGame } from "@/lib/highland-charge";
import { listLaunchSeatsFn, verifyKingFn } from "@/lib/launch-seats.functions";
import { kingEligible, kingMessage } from "@/lib/launch-seats";
import { useServerFn } from "@tanstack/react-start";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";

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
  const session = useWalletSession();
  const verify = useServerFn(verifyKingFn);
  // Held in page memory only: every visit signs again, and it is dropped when the wallet changes.
  const [king, setKing] = useState<{ address: string; seat: number; vip: boolean } | null>(null);
  const [kingMsg, setKingMsg] = useState<string | null>(null);
  // Dev-only test fixture (stripped from production builds): stands in for a server-verified seat so
  // automated browser tests can drive the King flow without a real wallet signature.
  const [devKing, setDevKing] = useState<{ address: string; seat: number; vip: boolean } | null>(null);
  const verified = import.meta.env.DEV && devKing ? devKing : king && session && king.address === session.ordinalsAddress ? king : null;
  const vip = kingEligible(verified, focus);
  game.vip = vip;
  const proveKing = async () => {
    if (!session) { setKingMsg("Connect your wallet first"); return; }
    setKingMsg(null);
    try {
      const address = session.ordinalsAddress, issuedAt = new Date().toISOString();
      const signature = await signMessageWithWallet(session.provider, address, kingMessage(address, issuedAt));
      const r = await verify({ data: { address, issuedAt, signature } });
      if (!r.ok) { setKing(null); setKingMsg(r.error === "NO_SEAT" ? "This wallet has no Grandstand seat" : r.error); return; }
      setKing({ address, seat: r.seat, vip: r.vip });
      setFocus(r.seat); setInput(String(r.seat));
      setKingMsg(r.vip ? `Seat ${r.seat} verified — you ride as King` : `Seat ${r.seat} verified — no VIP pass or Founders Row seat`);
    } catch (e) { setKingMsg((e as Error).message); }
  };
  useEffect(() => {
    game.best = Number(localStorage.getItem("charge-best") ?? 0) || 0;
    game.glory = Number(localStorage.getItem("charge-glory") ?? 0) || 0;
    const id = setInterval(() => {
      setHud({ ...game });
      localStorage.setItem("charge-best", String(game.best));
      localStorage.setItem("charge-glory", String(game.glory));
    }, 150);
    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); game.raise = true; }
      if (e.code === "KeyF" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); game.thrust = true; }
      if (e.code === "KeyE" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); game.mount = true; }
    };
    window.addEventListener("keydown", key);
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__charge = { game, follow: (n: number) => { setFocus(n); setInput(String(n)); }, fixtureKing: (seat: number, vip: boolean) => setDevKing({ address: "fixture", seat, vip }) };
    return () => { clearInterval(id); window.removeEventListener("keydown", key); };
  }, [game]);
  const danger = hud.next && hud.next.in < 1.2 && hud.heroDownAt == null;
  return (
    <main className="relative h-[calc(100dvh-9rem)] w-full overflow-hidden bg-background">
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
            <button type="button" onClick={proveKing} className="rounded border border-primary px-3 py-1 text-primary">♛ PROVE VIP</button>
            <Link to="/launch" className="ml-auto self-center text-accent">← GRANDSTAND</Link>
          </form>
          {kingMsg && <p className="mt-1 text-accent">{kingMsg}</p>}
          {/* Battle stats live inside the top panel so they never stack over it on phones. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2">
          <span className="font-bold text-foreground">STANDING {hud.standing}</span>
          <span className="text-destructive">FALLEN {hud.casualties}</span>
          {playing ? (
            <>
            <span className="text-foreground">BLOCKS {hud.blocks}</span>
            <span className="text-foreground">STREAK {hud.streak}</span>
            <span className="text-muted-foreground">BEST {hud.best}</span>
            <span className={danger ? "animate-pulse font-bold text-destructive" : "text-muted-foreground"}>
              {hud.heroDownAt != null ? "YOU FELL — RISE NEXT CHARGE" : hud.next ? `${hud.next.kind === "arrows" ? "ARROWS" : "CAVALRY"} IN ${Math.max(0, hud.next.in).toFixed(1)}s` : "HOLD THE LINE"}
            </span>
            {vip && <span className="font-bold text-primary">♛ KING · GLORY {hud.glory}</span>}
            {hud.last && <span className={hud.last === "HIT" ? "font-bold text-destructive" : "font-bold text-primary"}>{hud.last === "RALLY" ? "FOR BITCOIN! CHARGE!" : hud.last === "BREAKOUT" ? `WALL BROKEN +${hud.lastGlory} GLORY` : hud.last === "SPEARED" ? (hud.vip ? "RIDER UNSEATED! TAKE THE HORSE [E]" : "RIDER UNSEATED!") : hud.last === "BLOCKED" && hud.rider === "stopped" ? "HORSE STOPPED!" : `${hud.last}!`}</span>}
            </>
          ) : (
            <span className="text-muted-foreground">Follow a soldier to fight: raise your shield as arrows land, then shield to stop the rider charging at you or spear to unseat him. Unblocked riders gallop straight through. VIP pass holders and Founders Row press PROVE VIP to sign with their wallet, spear their rider, then take his horse and lead the army through the wall.</span>
          )}
          </div>
        </div>
      </div>
      {playing && (
        // Actions sit at the bottom within thumb reach, leaving the battlefield in view.
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 font-mono text-xs">
              {vip && (
                <button
                  onPointerDown={(e) => { e.preventDefault(); game.mount = true; }}
                  disabled={!hud.rallyReady}
                  className={`rounded border border-primary bg-background/85 px-5 py-3 text-primary disabled:opacity-40 ${hud.rallyReady ? "animate-pulse" : ""}`}
                >[E] MOUNT &amp; RALLY</button>
              )}
              <button
                onPointerDown={(e) => { e.preventDefault(); game.raise = true; }}
                disabled={!hud.shieldReady || hud.heroDownAt != null}
                className="rounded bg-primary px-5 py-3 text-primary-foreground disabled:opacity-40"
              >[SPACE] SHIELD</button>
              <button
                onPointerDown={(e) => { e.preventDefault(); game.thrust = true; }}
                disabled={!hud.spearReady || hud.heroDownAt != null}
                className="rounded border border-primary bg-background/85 px-5 py-3 text-primary disabled:opacity-40"
              >[F] SPEAR</button>
          </div>
        </div>
      )}
    </main>
  );
}
