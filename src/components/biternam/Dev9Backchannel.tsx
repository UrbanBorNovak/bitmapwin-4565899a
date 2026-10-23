/** Founders-only dev9 terminal in the Batcave. The server checks signature + seat 1–100 and only then sends the log. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { WalletConnect } from "@/components/WalletConnect";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { saveWalletSession, useWalletSession } from "@/lib/wallet-session";
import { openBackchannelFn } from "@/lib/launch-seats.functions";
import { backchannelMessage } from "@/lib/launch-seats";
import { playSfx } from "@/lib/retro-sfx";

export function Dev9Backchannel() {
  const session = useWalletSession();
  const open = useServerFn(openBackchannelFn);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [log, setLog] = useState<{ seat: number; lines: string[] } | null>(null);

  const swipe = async () => {
    if (!session) return;
    setBusy(true); setMsg(null);
    try {
      const issuedAt = new Date().toISOString();
      const address = session.ordinalsAddress;
      const signature = await signMessageWithWallet(session.provider, address, backchannelMessage(address, issuedAt));
      const r = await open({ data: { address, issuedAt, signature } });
      if (!r.ok) {
        playSfx("deny");
        setMsg(r.error === "NO_SEAT" ? "No seat on this wallet. dev9 doesn't know you yet." : r.error === "NOT_FOUNDER" ? "Seated, but not Founders Row. This channel is for seats 1–100." : r.error);
        return;
      }
      playSfx("pickup");
      setLog({ seat: r.seat, lines: r.log });
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  if (!show) {
    return (
      <button type="button" data-testid="backchannel-open" onClick={() => { playSfx("verb"); setShow(true); }}
        className="pointer-events-auto absolute left-3 top-3 rounded border border-bitcoin/70 bg-background/85 px-3 py-1 font-mono text-[11px] text-bitcoin hover:border-bitcoin">
        [ FR KEYCARD SLOT ]
      </button>
    );
  }
  return (
    <div data-testid="backchannel-panel" className="pointer-events-auto absolute left-3 top-3 w-80 max-w-[calc(100%-1.5rem)] rounded border border-bitcoin/70 bg-background/90 p-3 font-mono text-[11px] backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="tracking-[0.25em] text-bitcoin">DEV9 · BACKCHANNEL</span>
        <button type="button" onClick={() => { setShow(false); setLog(null); }} className="text-muted-foreground hover:text-foreground">[X]</button>
      </div>
      {log ? (
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          <div className="text-signal" data-no-translate>FOUNDER #{log.seat} · CHANNEL OPEN</div>
          {log.lines.map((l, i) => <p key={i} className="text-foreground">&gt; {l}</p>)}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-muted-foreground">Founders Row keycards only. Sign once with your seated wallet. No fee, nothing moves.</p>
          {session ? (
            <button type="button" disabled={busy} onClick={swipe} className="rounded border border-bitcoin px-3 py-1 text-bitcoin disabled:opacity-50">{busy ? "READING CARD…" : "[ SWIPE KEYCARD ]"}</button>
          ) : <WalletConnect onConnect={(w) => saveWalletSession(w)} />}
          {msg ? <p className="text-destructive">{msg}</p> : null}
          <Link to="/launch" className="inline-block text-muted-foreground underline">No seat? Get one at the grandstand.</Link>
        </div>
      )}
    </div>
  );
}
