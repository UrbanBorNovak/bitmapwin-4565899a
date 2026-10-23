import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { saveWalletSession, useWalletSession } from "@/lib/wallet-session";
import { claimStandSeatFn, getStandFn } from "@/lib/sovereign-stand.functions";
import { standMessage } from "@/lib/sovereign-stand";
import { assignedPixel, type LaunchSeat } from "@/lib/launch-seats";

const Grandstand = lazy(() => import("@/components/launch/LaunchGrandstand3D"));

export const Route = createFileRoute("/stand/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Sovereign Grandstand ${params.id.slice(0, 8)}… | BITMAPWIN` },
      { name: "description", content: "A BW-STAND-1 grandstand: BITMAP holders sign one free message to take a numbered seat. Every seat keeps its public proof." },
      { property: "og:title", content: "Sovereign Grandstand · BW-STAND-1" },
      { property: "og:description", content: "Hold a BITMAP, sign once, take a seat. No fees, no contracts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StandPage,
});

function StandPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const session = useWalletSession();
  const claim = useServerFn(claimStandSeatFn);
  const q = useQuery({ queryKey: ["stand", id], queryFn: () => getStandFn({ data: { id } }), refetchInterval: 30_000 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const seats: LaunchSeat[] = (q.data?.seats ?? []).map((s) => ({ seat: s.seat, address: s.address, pixelId: assignedPixel(s.address), pixelSource: "assigned", heldBitmap: s.heldBitmap, createdAt: s.createdAt }));
  const mine = session ? seats.find((s) => s.address.toLowerCase() === session.ordinalsAddress.toLowerCase()) ?? null : null;
  const cfg = q.data?.config;

  const take = async () => {
    if (!session) return;
    setBusy(true); setMsg(null);
    try {
      const issuedAt = new Date().toISOString();
      const address = session.ordinalsAddress;
      const signature = await signMessageWithWallet(session.provider, address, standMessage(id, address, issuedAt));
      const r = await claim({ data: { id, address, issuedAt, signature } });
      if (!r.ok) { setMsg(r.error === "NO_BITMAP" ? "This wallet holds no BITMAP that this stand accepts." : r.error); return; }
      setMsg(r.already ? `You already hold seat #${r.seat.seat}.` : `Seated: #${r.seat.seat}.`);
      setSelected(r.seat.seat);
      await qc.invalidateQueries({ queryKey: ["stand", id] });
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  if (q.isLoading) return <main className="p-8 font-mono text-sm text-muted-foreground">READING THE STAND INSCRIPTION…</main>;
  if (!cfg) return (
    <main className="mx-auto max-w-xl p-8 font-mono text-sm">
      <p className="text-muted-foreground">{q.data?.error ?? "Stand unavailable."}</p>
      <Link to="/stand" className="mt-3 inline-block text-signal underline">How to create a stand</Link>
    </main>
  );
  const range = cfg.bitmap?.min !== undefined || cfg.bitmap?.max !== undefined ? `BITMAP ${cfg.bitmap?.min ?? 0}–${cfg.bitmap?.max ?? "∞"}` : "ANY BITMAP";
  return (
    <main className="retro-crt flex min-h-[calc(100dvh-4rem)] flex-col bg-background font-mono">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-signal">BW-STAND-1 · {range}{cfg.host ? ` · HOST ${cfg.host}` : ""}</div>
          <h1 className="font-display text-2xl">{cfg.name}</h1>
          <div className="text-[11px] text-muted-foreground"><span className="text-bitcoin">{seats.length}</span> SEATED · STAND <span data-no-translate>{id.slice(0, 10)}…</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {mine ? <span className="rounded border border-primary px-3 py-1 text-primary">SEAT #{mine.seat}</span> : session ? (
            <button type="button" disabled={busy} onClick={take} className="rounded border border-bitcoin px-3 py-1 text-bitcoin disabled:opacity-50">{busy ? "SIGNING…" : "[ TAKE YOUR SEAT ]"}</button>
          ) : <WalletConnect onConnect={(w) => saveWalletSession(w)} />}
          <Link to="/stand" className="rounded border border-border px-3 py-1 hover:border-signal">[ CONVENTION BADGE ]</Link>
        </div>
      </div>
      {msg ? <p className="px-4 text-[12px] text-signal">{msg}</p> : null}
      {cfg.jumbotron?.length ? <div className="overflow-hidden whitespace-nowrap border-y border-border px-4 py-1 text-[12px] text-bitcoin">▶ {cfg.jumbotron.join("  ·  ")}</div> : null}
      <div className="relative min-h-[60vh] flex-1">
        <ClientOnly fallback={<div className="grid h-full place-items-center text-xs text-muted-foreground">loading grandstand…</div>}>
          <Suspense fallback={null}>
            <Grandstand seats={seats} myAddress={session?.ordinalsAddress ?? null} selected={selected} onPick={(s) => setSelected(s.seat)} focusSeat={selected} mySeat={mine?.seat ?? null} />
          </Suspense>
        </ClientOnly>
      </div>
    </main>
  );
}
