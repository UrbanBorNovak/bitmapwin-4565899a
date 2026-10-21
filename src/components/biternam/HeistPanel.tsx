import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { HEIST_STEPS, HEIST_ITEMS, HEIST_BIT, advanceHeist, heistStepKey, heldHeistItem, resetHeist, setHeistStage, useHeistStage, type HeistRoom } from "@/lib/void-heist";
import { claimHeistRewardFn, heistStatusFn, recordHeistStepFn } from "@/lib/void-heist.functions";
import { useWalletSession } from "@/lib/wallet-session";
import { playSfx } from "@/lib/retro-sfx";

/** CH.4 objective card shown in every interior; acts only when this room is the current link. */
export function HeistPanel({ room, ready = true }: { room: HeistRoom; ready?: boolean }) {
  const stage = useHeistStage();
  const [open, setOpen] = useState(true);
  const [line, setLine] = useState<string | null>(null);
  const [boom, setBoom] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const status = useServerFn(heistStatusFn);
  const record = useServerFn(recordHeistStepFn);
  const claim = useServerFn(claimHeistRewardFn);
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  const step = HEIST_STEPS[stage];
  const held = heldHeistItem(stage);
  const here = step?.room === room;

  // Signed in: the account's server-recorded progress is the truth on every device.
  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!live) return;
      const ok = !!data.session;
      setSignedIn(ok);
      if (!ok) return;
      const s = await status();
      if (live && s.ok) { setHeistStage(s.stage); setClaimed(s.claimed); }
    });
    return () => { live = false; };
  }, [status]);

  const act = async () => {
    if (!step || !here || !ready || busy) { playSfx("deny"); return; }
    if (signedIn) {
      setBusy(true); setNote(null);
      try {
        const r = await record({ data: { index: stage, key: heistStepKey(step) } });
        if (!r.ok) {
          playSfx("deny");
          setNote(r.status === "too_fast" ? "TOO FAST — TRY AGAIN IN A MOMENT" : r.status === "out_of_order" ? "OUT OF ORDER — RESYNCING" : "COULD NOT SAVE — TRY AGAIN");
          if (r.status === "out_of_order") { const s = await status(); if (s.ok) setHeistStage(s.stage); }
          return;
        }
      } catch { playSfx("deny"); setNote("COULD NOT SAVE — TRY AGAIN"); return; }
      finally { setBusy(false); }
    }
    if (advanceHeist(stage)) {
      setLine(step.line);
      if (step.gives === "void") { playSfx("fall"); setBoom(true); setTimeout(() => setBoom(false), 2600); } else playSfx("pickup");
    }
  };

  const collect = async () => {
    if (!address || busy) return;
    setBusy(true); setNote(null);
    try {
      const r = await claim({ data: { address } });
      if (r.ok) { setClaimed(true); playSfx("pickup"); setNote(r.already ? "ALREADY PAID TO THIS ACCOUNT" : `+${HEIST_BIT} BIT PAID`); }
      else setNote(r.error);
    } catch { setNote("PAYOUT FAILED — TRY AGAIN"); }
    finally { setBusy(false); }
  };

  return (
    <>
      {boom && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center animate-pulse bg-background/70 backdrop-blur-sm">
          <div className="font-mono text-2xl tracking-widest text-primary">◎ THE VOID IS OPEN ◎</div>
        </div>
      )}
      <div data-testid="heist-panel" className="absolute right-3 top-14 z-30 w-72 max-w-[calc(100vw-1.5rem)] border border-primary/40 bg-card/85 p-3 font-mono text-[11px] backdrop-blur">
        <button className="flex w-full justify-between text-primary" onClick={() => setOpen((o) => !o)}>
          <span>CH.4 · THE VOID HEIST {stage}/{HEIST_STEPS.length}</span><span>{open ? "−" : "+"}</span>
        </button>
        {open && (
          <div className="mt-2 space-y-2">
            <div className="text-muted-foreground">HOLDING: <span className="text-foreground">{held ? HEIST_ITEMS[held] : "NOTHING"}</span></div>
            {step ? (
              <>
                <div className="text-accent">{here ? "▶ " : "→ "}{step.hint}{!here && ` (${step.room.toUpperCase()})`}</div>
                {here && (
                  <button onClick={act} disabled={!ready || busy} className="w-full border border-primary bg-primary/15 px-2 py-1.5 text-primary hover:bg-primary/30 disabled:opacity-40">
                    {!ready ? "FINISH THIS ROOM'S PUZZLE FIRST" : busy ? "SAVING…" : step.action}
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-primary">★ VOID HEIST COMPLETE — the trapdoor stands open.</div>
                <Link to="/biternam/void" className="block w-full border border-signal bg-signal/10 px-2 py-1.5 text-center text-signal hover:bg-signal/25">▼ CLIMB DOWN INTO THE VOID</Link>
                {signedIn && !claimed && (
                  address
                    ? <button onClick={collect} disabled={busy} className="w-full border border-primary bg-primary/15 px-2 py-1.5 text-primary hover:bg-primary/30 disabled:opacity-40">CLAIM {HEIST_BIT} BIT</button>
                    : <div className="text-muted-foreground">Connect a wallet to claim {HEIST_BIT} BIT.</div>
                )}
                {claimed && <div className="text-accent">✓ {HEIST_BIT} BIT REWARD PAID</div>}
                {!signedIn && <button onClick={() => { resetHeist(); setLine(null); }} className="text-muted-foreground underline">replay chapter</button>}
              </div>
            )}
            {signedIn === false && <div className="text-muted-foreground">Playing on this device only. Sign in to save progress and earn {HEIST_BIT} BIT.</div>}
            {signedIn && <div className="text-muted-foreground">✓ Progress saved to your account</div>}
            {note && <div className="text-primary">{note}</div>}
            {line && <div className="border-t border-border pt-2 text-foreground">{line}</div>}
          </div>
        )}
      </div>
    </>
  );
}
