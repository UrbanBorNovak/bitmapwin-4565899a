import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { PixelFace } from "@/components/game/PixelFace";
import { signMessageWithWallet, type ConnectedWallet } from "@/lib/browser-wallet";
import { saveWalletSession, useWalletSession } from "@/lib/wallet-session";
import { claimLaunchSeatFn, listLaunchSeatsFn } from "@/lib/launch-seats.functions";
import { playSfx } from "@/lib/world-audio";
import { listSponsorSlidesFn } from "@/lib/sponsor-slots.functions";
import { slotLive } from "@/lib/sponsor-slots";
import { SponsorBooking } from "@/components/launch/SponsorBooking";
import { LaunchTicket } from "@/components/launch/LaunchTicket";
import { useQuery } from "@tanstack/react-query";
import { ZapDialog } from "@/components/lightning/ZapDialog";
import { DONATION_ADDRESS } from "@/lib/donations";
import { CAFE_TIP_ADDRESS, QUICK_TIP_SATS, celebrateTip, tipLine, useTipBanner } from "@/lib/tip-banner";
import type { GrandstandView } from "@/components/launch/LaunchGrandstand3D";
import { GEAR_LABEL, LAUNCH_CAPACITY, LAUNCH_TIERS, nextTier, seatMessage, type LaunchSeat } from "@/lib/launch-seats";

const Grandstand = lazy(() => import("@/components/launch/LaunchGrandstand3D"));

const seatsQuery = queryOptions({ queryKey: ["launch-seats"], queryFn: () => listLaunchSeatsFn(), staleTime: 15_000, refetchInterval: 30_000 });

export const Route = createFileRoute("/launch")({
  head: () => {
    const title = "Bitmappers Launch Grandstand — BITMAPWIN";
    const description = "Connect your wallet, sign once (no fee) and take a seat with your BITMAP Pixel avatar. Seats unlock launch tiers at 100, 500 and 1,000 Bitmappers.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(seatsQuery),
  component: LaunchPage,
});

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function LaunchPage() {
  const { data } = useSuspenseQuery(seatsQuery);
  const seats = data.seats;
  const qc = useQueryClient();
  const session = useWalletSession();
  const claim = useServerFn(claimLaunchSeatFn);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<LaunchSeat | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [view, setView] = useState<GrandstandView>("diorama");
  const [tipOpen, setTipOpen] = useState(false);
  const stageTip = useTipBanner("launch");
  const blip = () => { try { playSfx("pick"); } catch { /* audio locked */ } };
  const pickSeat = (s: LaunchSeat | null | undefined) => { blip(); setPicked(s ?? null); setFocus(s?.seat ?? null); if (s && view === "seat") setView("diorama"); };
  const stepSeat = (dir: number) => {
    if (!seats.length) return;
    const i = picked ? seats.findIndex((x) => x.seat === picked.seat) : -1;
    pickSeat(seats[(i + dir + seats.length) % seats.length]);
  };
  const active = wallet ?? session;
  const myAddr = active?.ordinalsAddress ?? null;
  const mine = myAddr ? seats.find((s) => s.address.toLowerCase() === myAddr.toLowerCase()) ?? null : null;
  const count = seats.length;
  const sponsorQ = useQuery({ queryKey: ["sponsor-slides"], queryFn: () => listSponsorSlidesFn(), refetchInterval: 300_000 });
  const stageAds = (sponsorQ.data?.slides ?? []).filter((x) => slotLive(x, "launch", Date.now()));
  const tier = nextTier(count);

  const takeSeat = async () => {
    if (!active) return;
    setBusy(true); setMsg(null);
    try {
      const issuedAt = new Date().toISOString();
      const address = active.ordinalsAddress;
      const signature = await signMessageWithWallet(active.provider, address, seatMessage(address, issuedAt));
      const res = await claim({ data: { address, issuedAt, signature } });
      if (!res.ok) { setMsg(res.error); return; }
      await qc.invalidateQueries({ queryKey: ["launch-seats"] });
      setPicked(res.seat); setFocus(res.seat.seat);
      setMsg(res.already ? `You already hold seat #${res.seat.seat}` : `Welcome, Bitmapper — seat #${res.seat.seat} is yours`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="font-mono text-xs text-signal">LAUNCH PHOTO · LIVE</p>
          <h1 className="mt-1 font-display text-4xl">Every wallet is a Bitmapper.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect, sign once and your BITMAP Pixel avatar takes a seat in the launch grandstand. Hold a Pixel and you sit as it; hold a BITMAP and you raise its flag. Your inscriptions never leave your wallet.
          </p>
        </div>
        <div className="glass-panel w-full max-w-sm rounded border border-border p-4">
          {mine ? (
            <>
            <div className="flex items-center gap-3">
              <PixelFace inscriptionId={mine.pixelId} label="Your avatar" className="h-14 w-14" />
              <div className="font-mono text-xs">
                <div className="text-bitcoin">SEAT #{mine.seat}</div>
                <div className="text-muted-foreground">{mine.pixelSource === "held" ? "Wearing your own Pixel" : "Assigned Pixel"}{mine.heldBitmap !== null ? ` · ${mine.heldBitmap}.bitmap` : ""}</div>
                <button className="mt-1 text-signal hover:underline" onClick={() => pickSeat(mine)}>Find my seat →</button>
              </div>
            </div>
            <LaunchTicket seat={mine} />
            </>
          ) : active ? (
            <>
              <button disabled={busy || count >= LAUNCH_CAPACITY} onClick={takeSeat}
                className="w-full rounded bg-bitcoin px-4 py-3 font-mono text-sm font-bold text-primary-foreground disabled:opacity-50">
                {busy ? "WAITING FOR SIGNATURE…" : "TAKE YOUR SEAT"}
              </button>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">Message signature only · no transaction, no fee · {short(active.ordinalsAddress)}</p>
            </>
          ) : (
            <WalletConnect onConnect={(w) => { setWallet(w); saveWalletSession(w); }} />
          )}
          {msg && <p className="mt-2 font-mono text-xs text-signal">{msg}</p>}
        </div>
      </div>

      <section className="mt-6">
        <div className="flex flex-wrap justify-between gap-2 font-mono text-xs">
          <span><b className="text-bitcoin">{count.toLocaleString()}</b> of {LAUNCH_CAPACITY.toLocaleString()} Bitmappers seated</span>
          <span className="text-muted-foreground">{tier ? `${tier.seats - count} to ${tier.name}` : "ALL TIERS UNLOCKED"}</span>
        </div>
        <div className="relative mt-2 h-2 rounded bg-muted">
          <div className="h-2 rounded bg-bitcoin" style={{ width: `${(count / LAUNCH_CAPACITY) * 100}%` }} />
          {LAUNCH_TIERS.map((t) => (
            <span key={t.seats} className={`absolute -top-1 h-4 w-0.5 ${count >= t.seats ? "bg-signal" : "bg-border"}`} style={{ left: `calc(${(t.seats / LAUNCH_CAPACITY) * 100}% - 1px)` }} />
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {LAUNCH_TIERS.map((t) => (
            <div key={t.seats} className={`glass-panel rounded border p-3 font-mono text-xs ${count >= t.seats ? "border-signal" : "border-border"}`}>
              <div className={count >= t.seats ? "text-signal" : "text-bitcoin"}>{t.seats.toLocaleString()} · {t.name}</div>
              <div className="mt-1 text-muted-foreground">{t.perk}{count >= t.seats ? " · UNLOCKED" : ""}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="retro-crt relative mt-6 h-[64vh] min-h-[460px] overflow-hidden rounded border border-border">
        <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">loading grandstand…</div>}>
          <Suspense fallback={null}>
            <Grandstand seats={seats} myAddress={myAddr} selected={picked?.seat ?? null} focusSeat={focus}
              view={view} mySeat={mine?.seat ?? null} sponsors={stageAds} onPick={(s) => pickSeat(s)} />
          </Suspense>
        </ClientOnly>
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] text-signal">
          <div>CINDY-COM · LAUNCH FEED ● LIVE</div>
          <div className="text-muted-foreground">CAP {count}/{LAUNCH_CAPACITY} · CAM {view.toUpperCase()}</div>
        </div>
        <button type="button" onClick={() => { blip(); setTipOpen(true); }}
          className="glass-panel absolute right-3 top-3 rounded border border-primary/70 px-2 py-1 font-mono text-[10px] text-primary hover:border-primary">[ ⚡ TIP JUMBOTRON ]</button>
        {stageTip ? (
          <div data-testid="stage-tip-banner" className="pointer-events-none absolute inset-x-0 bottom-0 bg-primary px-3 py-2 text-center font-mono text-sm font-bold tracking-wider text-primary-foreground">
            LIVE TIP · {tipLine(stageTip)}
          </div>
        ) : null}
        <ZapDialog open={tipOpen} onOpenChange={setTipOpen} to="THE JUMBOTRON" address={CAFE_TIP_ADDRESS} comment="Tip from the Launch Grandstand · BITMAPWIN"
          defaultSats={QUICK_TIP_SATS} presets={[1000, 2100, 5000]} onchainAddress={DONATION_ADDRESS} askName
          onPaid={(s, who) => celebrateTip(who, s, "launch")} />
        <div className="absolute left-3 right-3 top-12 flex flex-wrap gap-2 font-mono text-[10px]">
          {([["diorama", "2.5D DIORAMA"], ["stage", "STAGE VIEW"], ["seat", "SIT IN MY SEAT"]] as const).map(([v, label]) => (
            <button key={v} disabled={v === "seat" && !mine}
              className={`glass-panel rounded border px-2 py-1 disabled:opacity-40 ${view === v && !focus ? "border-signal text-signal" : "border-border"}`}
              onClick={() => { blip(); setView(v); setFocus(null); }}>{label}</button>
          ))}
          <span className="mx-1 self-center text-muted-foreground">|</span>
          <button className="glass-panel rounded border border-border px-2 py-1" onClick={() => stepSeat(-1)}>[PREV]</button>
          <button className="glass-panel rounded border border-border px-2 py-1" onClick={() => stepSeat(1)}>[NEXT]</button>
          <button className="glass-panel rounded border border-border px-2 py-1" onClick={() => seats.length && pickSeat(seats[Math.floor(Math.random() * seats.length)])}>[RANDOM]</button>
          <button className="glass-panel rounded border border-border px-2 py-1 text-bitcoin" onClick={() => seats[0] && pickSeat(seats.find((x) => x.seat === 1) ?? seats[0])}>[FOUNDERS #1]</button>
          {count === 0 && <span className="glass-panel rounded border border-border px-2 py-1 text-muted-foreground">EMPTY SEATS — BE THE FIRST BITMAPPER</span>}
        </div>
        {picked && (
          <div className="glass-panel absolute bottom-3 right-3 w-60 max-w-[calc(100%-1.5rem)] rounded border border-signal/50 p-3 font-mono text-xs">
            <div className="mb-2 flex justify-between text-[10px] text-signal"><span>&gt; INSPECT</span><button onClick={() => pickSeat(null)} aria-label="Close">[X]</button></div>
            <div className="flex items-center gap-2">
              <PixelFace inscriptionId={picked.pixelId} label="Avatar" className="h-12 w-12" />
              <div><div className="text-bitcoin">SEAT #{picked.seat}</div><div className="text-muted-foreground">{short(picked.address)}</div></div>
            </div>
            <div className="mt-2 text-signal">{picked.seat <= 100 ? "FOUNDERS ROW" : picked.seat <= 500 ? "FULL HOUSE" : "IGNITION"}</div>
            <div className="text-muted-foreground">{picked.pixelSource === "held" ? "Own Pixel (wallet scan)" : "Assigned Pixel"}</div>
            {picked.heldBitmap !== null && <Link to="/map/$block" params={{ block: String(picked.heldBitmap) }} className="text-signal hover:underline">Holds {picked.heldBitmap}.bitmap →</Link>}
            {picked.gear?.map((g) => <div key={g} className="text-muted-foreground">◆ {GEAR_LABEL[g]}</div>)}
            <div className="text-muted-foreground">Seated {new Date(picked.createdAt).toLocaleDateString()}</div>
            {picked.ticketId && <a href={`https://ordinals.com/inscription/${picked.ticketId}`} target="_blank" rel="noreferrer" className="text-bitcoin hover:underline">★ VIP TICKET →</a>}
          </div>
        )}
      </section>
      <SponsorBooking wallet={active} />
    </main>
  );
}
