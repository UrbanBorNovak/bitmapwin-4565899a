import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { PixelFace } from "@/components/game/PixelFace";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { saveWalletSession, useWalletSession } from "@/lib/wallet-session";
import { enterLoungeFn, listLaunchSeatsFn } from "@/lib/launch-seats.functions";
import { FOUNDERS_ROW, foundersOf, loungeMessage, type LaunchSeat } from "@/lib/launch-seats";
import { playSfx, startCafeMusic, stopCafeMusic, type RoomMood } from "@/lib/retro-sfx";

export const Route = createFileRoute("/biternam_/lounge")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Backstage VIP Lounge · Biternam | BITMAPWIN" },
      { name: "description", content: "A members-only Biternam lounge for seated Bitmappers: retro booths, a chiptune jukebox and the Hall of Founders." },
      { property: "og:title", content: "Backstage VIP Lounge · Biternam" },
      { property: "og:description", content: "Hold a launch seat, sign once, and the velvet rope lifts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoungePage,
});

const PASS_KEY = "biternam.lounge.seat";
const TRACKS: { mood: RoomMood; name: string }[] = [
  { mood: "cafe", name: "BIT-CAFÉ BLUES" }, { mood: "arcade", name: "INSERT BLOCK" }, { mood: "island", name: "OFFSHORE ATOLL" },
  { mood: "safehouse", name: "RAIN ON 1138" }, { mood: "studio", name: "BREAKING BLOCK" }, { mood: "canon", name: "FORGERY WALTZ" },
];
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function LoungePage() {
  const session = useWalletSession();
  const enter = useServerFn(enterLoungeFn);
  const seatsQ = useQuery({ queryKey: ["launch-seats"], queryFn: () => listLaunchSeatsFn(), staleTime: 60_000 });
  const [seat, setSeat] = useState<LaunchSeat | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [noSeat, setNoSeat] = useState(false);
  const [track, setTrack] = useState<number | null>(null);

  useEffect(() => { try { const s = sessionStorage.getItem(PASS_KEY); if (s) setSeat(JSON.parse(s) as LaunchSeat); } catch { /* none */ } }, []);
  useEffect(() => () => stopCafeMusic(), []);

  const knock = async () => {
    if (!session) return;
    setBusy(true); setMsg(null); setNoSeat(false);
    try {
      const issuedAt = new Date().toISOString();
      const address = session.ordinalsAddress;
      const signature = await signMessageWithWallet(session.provider, address, loungeMessage(address, issuedAt));
      const r = await enter({ data: { address, issuedAt, signature } });
      if (!r.ok) { playSfx("deny"); if (r.error === "NO_SEAT") setNoSeat(true); else setMsg(r.error); return; }
      playSfx("pickup"); setTimeout(() => playSfx("door"), 350);
      setSeat(r.seat); sessionStorage.setItem(PASS_KEY, JSON.stringify(r.seat));
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const play = (i: number) => {
    playSfx("verb");
    if (track === i) { stopCafeMusic(); setTrack(null); return; }
    stopCafeMusic(); startCafeMusic(TRACKS[i]!.mood); setTrack(i);
  };

  const founders = foundersOf(seatsQ.data?.seats ?? []);

  if (!seat) {
    return (
      <main className="retro-crt relative grid min-h-[calc(100dvh-4rem)] place-items-center bg-background p-4 font-mono">
        <div className="w-full max-w-md rounded border border-border bg-card p-5">
          <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · BACKSTAGE</div>
          <div className="mt-1 font-display text-2xl">THE VIP LOUNGE</div>
          <div className="my-4 flex items-center gap-2" aria-hidden="true">
            <span className="h-8 w-2 bg-primary" /><span className="h-1 flex-1 bg-destructive" /><span className="h-8 w-2 bg-primary" />
          </div>
          <p className="text-[13px] text-muted-foreground">Velvet rope. Seated Bitmappers only. Sign once with the wallet that holds your launch seat. No fee, nothing moves.</p>
          {session ? (
            <button type="button" disabled={busy} onClick={() => void knock()} className="mt-4 w-full rounded border border-primary px-3 py-2 text-[12px] tracking-widest text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
              {busy ? "CHECKING THE LIST…" : `[ SHOW MY SEAT · ${short(session.ordinalsAddress)} ]`}
            </button>
          ) : <div className="mt-4"><WalletConnect onConnect={(w) => saveWalletSession(w)} /></div>}
          {noSeat ? (
            <div className="mt-4 rounded border border-signal/60 p-3 text-[12px]">
              <div className="text-signal">CINDY-9 ▸</div>
              <p className="mt-1 text-foreground">"That wallet isn't on the list, Blockrunner. Grab a seat at the launch grandstand. It's free, and the rope lifts for you after."</p>
              <Link to="/launch" className="mt-2 inline-block text-primary underline">[ TAKE MY SEAT ]</Link>
            </div>
          ) : null}
          {msg ? <p className="mt-3 text-[12px] text-destructive">{msg}</p> : null}
          <Link to="/biternam/cafe" className="mt-4 block text-center text-[11px] text-muted-foreground hover:text-foreground">[ BACK TO THE BIT-CAFÉ ]</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="retro-crt relative min-h-[calc(100dvh-4rem)] bg-background px-4 py-6 font-mono">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · BACKSTAGE · ACCESS GRANTED</div>
            <h1 className="font-display text-3xl">THE VIP LOUNGE</h1>
            <p className="mt-1 text-[12px] text-primary">★ SEAT #{seat.seat}{seat.seat <= FOUNDERS_ROW ? " · FOUNDERS ROW" : ""}</p>
          </div>
          <div className="flex gap-2 text-[11px]">
            <Link to="/biternam/cafe" className="rounded border border-border px-3 py-1 hover:border-signal">[ BIT-CAFÉ ]</Link>
            <button type="button" onClick={() => { sessionStorage.removeItem(PASS_KEY); stopCafeMusic(); setSeat(null); }} className="rounded border border-border px-3 py-1 hover:border-signal">[ LEAVE ]</button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
          <section className="space-y-4">
            <div className="rounded border border-border bg-card p-4">
              <div className="text-[11px] tracking-[0.3em] text-bitcoin">YOUR BOOTH</div>
              <div className="mt-3 flex items-center gap-3">
                <PixelFace inscriptionId={seat.pixelId} label={`Seat ${seat.seat} Pixel`} className="h-16 w-16 border border-primary" />
                <div className="text-[12px]">
                  <div className="text-foreground">{short(seat.address)}</div>
                  <div className="text-muted-foreground">{seat.pixelSource === "held" ? "OWN PIXEL" : "ASSIGNED PIXEL"}{seat.heldBitmap !== null ? ` · FLAG ${seat.heldBitmap}.BITMAP` : ""}</div>
                </div>
              </div>
            </div>
            <div className="rounded border border-border bg-card p-4">
              <div className="text-[11px] tracking-[0.3em] text-signal">JUKEBOX</div>
              <p className="mt-1 text-[11px] text-muted-foreground">90s chiptune, made on your device.</p>
              <ul className="mt-3 space-y-1">
                {TRACKS.map((t, i) => (
                  <li key={t.mood}>
                    <button type="button" onClick={() => play(i)} className={`w-full rounded border px-2 py-1 text-left text-[12px] ${track === i ? "border-signal text-signal" : "border-border hover:border-signal"}`}>
                      {track === i ? "■" : "▶"} {String(i + 1).padStart(2, "0")} · {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded border border-border bg-card p-4">
            <div className="text-[11px] tracking-[0.3em] text-bitcoin">HALL OF FOUNDERS · SEATS 1–{FOUNDERS_ROW}</div>
            {seatsQ.isLoading ? <p className="mt-3 text-[12px] text-muted-foreground">HANGING THE PORTRAITS…</p> : (
              <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                {founders.map((f) => (
                  <div key={f.seat} title={`#${f.seat} · ${f.address}`} className={`border p-1 text-center ${f.seat === seat.seat ? "border-primary" : "border-border"}`}>
                    <PixelFace inscriptionId={f.pixelId} label={`Founder seat ${f.seat}`} className="mx-auto aspect-square w-full" />
                    <div className="mt-1 text-[9px] text-muted-foreground" data-no-translate>#{f.seat}</div>
                    <div className="truncate text-[8px] text-muted-foreground" data-no-translate>{short(f.address)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
