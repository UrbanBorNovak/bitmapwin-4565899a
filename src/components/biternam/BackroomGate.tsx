/** Sealed door in front of a Biternam backroom: present a Shadow Vault pass, or earn one. */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { draftPass, getPass, savePass, forgetPass } from "@/lib/shadow-vault";
import { verifyShadowPassFn } from "@/lib/shadow-assets.functions";
import { claimBackroomPassFn } from "@/lib/biternam-backroom.functions";
import type { BACKROOMS } from "@/lib/biternam-backroom";
import { playSfx } from "@/lib/retro-sfx";

type B = NonNullable<(typeof BACKROOMS)["vault"]>;
type Phase = "checking" | "sealed" | "claiming" | "invalid";

export function BackroomGate({ room, backroom, signedIn, onOpen }: { room: "vault" | "lair"; backroom: B; signedIn: boolean; onOpen: () => void }) {
  const verify = useServerFn(verifyShadowPassFn);
  const claim = useServerFn(claimBackroomPassFn);
  const [phase, setPhase] = useState<Phase>("checking");
  const [note, setNote] = useState<string | null>(null);

  const present = async () => {
    const pass = getPass(backroom.slug);
    if (!pass) { setPhase("sealed"); return; }
    setPhase("checking");
    try {
      const r = await verify({ data: { slug: backroom.slug, commitment: pass.commitment } });
      if (r.valid) { playSfx("door"); onOpen(); } else setPhase("invalid");
    } catch { setNote("COULD NOT REACH THE DOOR — TRY AGAIN"); setPhase("sealed"); }
  };
  useEffect(() => { void present(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const earn = async () => {
    setPhase("claiming"); setNote(null);
    const d = draftPass(backroom.slug);
    try {
      const r = await claim({ data: { room, commitment: d.commitment } });
      if (!r.ok) { playSfx("deny"); setNote(r.reason); setPhase("sealed"); return; }
      savePass({ ...d, passIndex: 0, claimedAt: new Date().toISOString() });
      playSfx("pickup");
      await present();
    } catch { setNote("COULD NOT ISSUE THE PASS — TRY AGAIN"); setPhase("sealed"); }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/90 p-4 font-mono">
      <div className="w-full max-w-md rounded border border-border bg-card p-5">
        <div className="text-[11px] tracking-[0.3em] text-signal">SEALED BACKROOM · SHADOW PASS REQUIRED</div>
        <div className="mt-1 font-display text-2xl text-foreground">{backroom.title}</div>
        {phase === "checking" || phase === "claiming" ? (
          <p className="mt-3 text-[13px] text-signal">{phase === "claiming" ? "ISSUING YOUR PASS…" : "CHECKING YOUR PASS…"}</p>
        ) : phase === "invalid" ? (
          <>
            <p className="mt-3 text-[13px] text-destructive">The pass on this device isn't on the list for this door.</p>
            <button type="button" onClick={() => { forgetPass(backroom.slug); setPhase("sealed"); }} className="mt-3 rounded border border-border px-3 py-1.5 text-[12px] hover:border-signal">[ REMOVE IT AND START OVER ]</button>
          </>
        ) : (
          <>
            <p className="mt-3 text-[13px] text-muted-foreground">
              Solve <span className="text-foreground">{backroom.earnedByName}</span> to earn a private pass. Your device makes the pass and keeps its secret. BITMAPWIN keeps only a fingerprint of it, and doesn't store which account the fingerprint belongs to.
            </p>
            {signedIn ? (
              <button type="button" onClick={() => void earn()} className="mt-4 w-full rounded border border-primary px-3 py-2 text-[12px] tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">[ EARN MY PASS ]</button>
            ) : (
              <Link to="/auth" className="mt-4 block w-full rounded border border-primary px-3 py-2 text-center text-[12px] tracking-widest text-primary hover:bg-primary hover:text-primary-foreground">[ SIGN IN TO EARN A PASS ]</Link>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">Have a pass on another device? Import its backup in the <Link to="/vault" className="text-signal hover:underline">Shadow Vault</Link>. One pass per account.</p>
          </>
        )}
        {note ? <p className="mt-3 text-[12px] text-destructive">{note}</p> : null}
      </div>
    </div>
  );
}
