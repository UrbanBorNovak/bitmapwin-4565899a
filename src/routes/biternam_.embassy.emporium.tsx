import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { saveWalletSession, useWalletSession } from "@/lib/wallet-session";
import { getEmporiumImagesFn } from "@/lib/game/emporium-images.functions";
import { inscriptionContentUrl } from "@/lib/game/pfpExtenders";
import { emporiumHolderCountFn, enterEmporiumEmbassyFn } from "@/lib/embassy.functions";
import { embassyMessage } from "@/lib/embassy";
import { playSfx } from "@/lib/retro-sfx";

const TITLE = "Bitmap Emporium Embassy · Biternam | BITMAPWIN";
const DESC = "The Bitmap Emporium's embassy in Biternam: on-chain Resident portraits, a live holder count and a holders-only hall opened by wallet signature.";

export const Route = createFileRoute("/biternam_/embassy/emporium")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: "Bitmap Emporium Embassy · Biternam" },
      { property: "og:description", content: "Hold a Resident portrait of 717328.bitmap, sign once, and the hall opens." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmbassyPage,
});

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function EmbassyPage() {
  const session = useWalletSession();
  const enter = useServerFn(enterEmporiumEmbassyFn);
  const art = useQuery({ queryKey: ["emporium-images"], queryFn: () => getEmporiumImagesFn(), staleTime: 3600_000 });
  const holders = useQuery({ queryKey: ["emporium-holders"], queryFn: () => emporiumHolderCountFn(), staleTime: 3600_000 });
  const [hall, setHall] = useState<{ portraits: string[]; parcels: number[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());

  const items = (art.data?.items ?? []).filter(([id]) => !broken.has(id));
  const wall = hall ? items : items.slice(0, 12);

  const knock = async () => {
    if (!session) return;
    setBusy(true); setMsg(null);
    try {
      const issuedAt = new Date().toISOString();
      const address = session.ordinalsAddress;
      const signature = await signMessageWithWallet(session.provider, address, embassyMessage("Emporium", address, issuedAt));
      const r = await enter({ data: { address, issuedAt, signature } });
      if (!r.ok) {
        playSfx("deny");
        setMsg(r.error === "NOT_HOLDER" ? "This wallet holds no Emporium Resident portrait or 717328 parcel right now." : r.error);
        return;
      }
      playSfx("door");
      setHall({ portraits: r.portraits, parcels: r.parcels });
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <main className="retro-crt relative min-h-[calc(100dvh-4rem)] bg-background px-4 py-6 font-mono">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · COLLECTION EMBASSY · 717328.BITMAP</div>
            <h1 className="font-display text-3xl">BITMAP EMPORIUM EMBASSY</h1>
            <p className="mt-1 text-[12px] text-muted-foreground">Their own collection, their own hall. You don't need a BITMAP to come in.</p>
          </div>
          <div className="flex gap-2 text-[11px]">
            <Link to="/oasis" className="rounded border border-border px-3 py-1 hover:border-signal">[ BACK TO THE OASIS ]</Link>
            <Link to="/collections/emporium" className="rounded border border-border px-3 py-1 hover:border-primary">[ TRADE ]</Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="HOLDERS ON CHAIN" value={holders.isPending ? "COUNTING…" : holders.data?.count == null ? "CHAIN BUSY" : holders.data.count.toLocaleString("en-US")} />
          <Stat label="RESIDENT PORTRAITS" value={art.isPending ? "LOADING…" : items.length ? items.length.toLocaleString("en-US") : "CHAIN BUSY"} />
          <Stat label="HALL STATUS" value={hall ? "OPEN · VERIFIED" : "SEALED"} accent={!!hall} />
        </div>

        {!hall ? (
          <div className="mt-6 rounded border border-primary/60 bg-card p-4">
            <div className="text-[11px] tracking-[0.3em] text-bitcoin">HOLDERS-ONLY DOOR</div>
            <p className="mt-1 text-[12px] text-muted-foreground">Sign a free message. We check the chain right then for a Resident portrait or a 717328 parcel in that wallet. Nothing is saved, so you sign again each visit.</p>
            {session ? (
              <button type="button" disabled={busy} onClick={() => void knock()} className="mt-3 rounded border border-primary px-3 py-2 text-[12px] tracking-widest text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
                {busy ? "CHECKING THE CHAIN…" : `[ SIGN & ENTER · ${short(session.ordinalsAddress)} ]`}
              </button>
            ) : <div className="mt-3"><WalletConnect onConnect={(w) => saveWalletSession(w)} /></div>}
            {msg ? <p className="mt-3 text-[12px] text-destructive">{msg}</p> : null}
          </div>
        ) : (
          <div className="mt-6 rounded border border-signal/60 bg-card p-4">
            <div className="text-[11px] tracking-[0.3em] text-signal">WELCOME, RESIDENT</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {hall.portraits.length} portrait{hall.portraits.length === 1 ? "" : "s"}{hall.parcels.length ? ` · parcels ${hall.parcels.join(", ")}` : ""} proven in your wallet. The full hall is open below.
            </p>
            {hall.portraits.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {hall.portraits.map((id) => (
                  <img key={id} src={inscriptionContentUrl(id)} alt="Your Resident portrait" className="h-24 w-24 border border-primary bg-muted object-contain [image-rendering:pixelated]" />
                ))}
              </div>
            ) : null}
          </div>
        )}

        <h2 className="mt-8 text-[11px] tracking-[0.3em] text-muted-foreground">{hall ? "THE FULL HALL · EVERY RESIDENT" : "THE LOBBY WALL · SIGN IN TO SEE THE FULL HALL"}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {wall.map(([id, n]) => (
            <a key={id} href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="border border-border bg-card p-1 hover:border-primary">
              <img src={inscriptionContentUrl(id)} alt={`Emporium #${n + 1}`} loading="lazy" onError={() => setBroken((b) => new Set(b).add(id))} className="aspect-square w-full bg-muted object-contain [image-rendering:pixelated]" />
              <div className="mt-1 text-center text-[10px] text-muted-foreground">#{n + 1}</div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="text-[10px] tracking-[0.3em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl ${accent ? "text-signal" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
