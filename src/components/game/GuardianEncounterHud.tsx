/**
 * Guardian encounter HUD: [E] commune prompt, the commune panel (roar, 10 BIT
 * tribute for Sovereign Stride, friendly spar), the spar bars and log, and the
 * active boon chip.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { payGuardianTributeFn } from "@/lib/coins.functions";
import { useWalletSession } from "@/lib/wallet-session";
import { playSfx } from "@/lib/world-audio";
import {
  SPAR_PLAYER_HP, TRIBUTE_BIT, endSpar, grantStride, hydrateBoon, openEncounter,
  playerStrike, requestRoar, startSpar, useEncounter,
  dismountGuardian, isGuardianOwner, mountGuardian, mountSpeed, useMountedGuardian,
} from "@/lib/guardian-encounter";

const STRIKE_COOLDOWN = 600;

export function GuardianEncounterHud() {
  const enc = useEncounter();
  const wallet = useWalletSession();
  const pay = useServerFn(payGuardianTributeFn);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [strikeAt, setStrikeAt] = useState(0);
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  const riding = useMountedGuardian();

  useEffect(() => { hydrateBoon(); }, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const strike = () => {
    const t = Date.now();
    if (!enc.spar || enc.spar.over || t - strikeAt < STRIKE_COOLDOWN) return;
    if (enc.near?.height !== enc.spar.height) { setNote("GET CLOSER TO STRIKE"); return; }
    setStrikeAt(t);
    playSfx("hit");
    playerStrike(6 + Math.random() * 6);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      if (key === "e" && riding) { e.preventDefault(); dismountGuardian(); }
      else if (key === "r" && riding) { e.preventDefault(); requestRoar(riding.height); playSfx("beast"); }
      else if (key === "e" && enc.near && !enc.open && !enc.spar) { e.preventDefault(); openEncounter(enc.near); }
      else if (key === "f" && enc.spar) { e.preventDefault(); strike(); }
      else if (e.key === "Escape" && enc.open) openEncounter(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // Close a finished bout a few seconds after it ends.
  useEffect(() => {
    if (!enc.spar?.over) return;
    playSfx(enc.spar.over === "won" ? "levelup" : "beast");
    const id = window.setTimeout(endSpar, 6000);
    return () => window.clearTimeout(id);
  }, [enc.spar?.over]);

  async function tribute() {
    const g = enc.open;
    if (!g) return;
    if (!address) return setNote("CONNECT A VERIFIED WALLET TO OFFER BIT");
    setBusy(true);
    setNote(null);
    try {
      const r = await pay({ data: { address, height: g.height } });
      if (!r.ok) return setNote(r.error);
      grantStride();
      requestRoar(g.height);
      playSfx("levelup");
      setNote(`SOVEREIGN STRIDE GRANTED · −${TRIBUTE_BIT} BIT`);
      void qc.invalidateQueries();
    } catch {
      setNote("SIGN IN AND VERIFY YOUR WALLET TO OFFER BIT");
    } finally {
      setBusy(false);
    }
  }

  const boonLeft = Math.max(0, enc.boonUntil - now);
  const mmss = `${String(Math.floor(boonLeft / 60000)).padStart(2, "0")}:${String(Math.floor((boonLeft % 60000) / 1000)).padStart(2, "0")}`;
  const g = enc.open;
  const s = enc.spar;

  return (
    <div data-no-translate className="pointer-events-none absolute inset-0 z-30 font-mono">
      {boonLeft > 0 && (
        <div className="hud-panel absolute left-1/2 top-14 -translate-x-1/2 border-signal/60 px-2.5 py-1 text-[10px] text-signal">
          ● SOVEREIGN STRIDE · +25% SPEED · {mmss}
        </div>
      )}

      {riding && (
        <div className="hud-panel pointer-events-auto absolute left-1/2 top-24 flex -translate-x-1/2 items-center gap-2 border-bitcoin px-2.5 py-1 text-[10px] text-bitcoin">
          <span>● RIDING {riding.species} · {riding.height}.BITMAP · ×{mountSpeed().toFixed(2)} SPEED</span>
          <button type="button" className="btn-term-ghost" onClick={() => { requestRoar(riding.height); playSfx("beast"); }}><span className="hidden md:inline">[R] </span>ROAR</button>
          <button type="button" className="btn-term-ghost" onClick={dismountGuardian}><span className="hidden md:inline">[E] </span>DISMOUNT</button>
        </div>
      )}

      {enc.near && !riding && !g && !s && (
        <button
          type="button"
          onClick={() => openEncounter(enc.near)}
          className="hud-panel pointer-events-auto absolute bottom-40 left-1/2 -translate-x-1/2 border-bitcoin px-3 py-2 text-[11px] text-bitcoin"
        >
          <span className="hidden md:inline">[E] </span>COMMUNE WITH {enc.near.species} · {enc.near.height}.BITMAP
        </button>
      )}

      {g && (
        <div className="hud-panel pointer-events-auto absolute left-1/2 top-1/2 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 space-y-3 p-4 text-[11px]" role="dialog" aria-label="Guardian encounter">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="label text-signal">BLOCK-DNA GUARDIAN · {g.rarity}</p>
              <h2 className="display text-xl">{g.species}</h2>
              <p className="text-muted-foreground">GUARDS {g.height}.BITMAP · LV {g.level}</p>
            </div>
            <button type="button" className="btn-term-ghost" onClick={() => openEncounter(null)} aria-label="Close">✕</button>
          </div>
          <dl className="grid grid-cols-4 gap-1 text-[10px]">
            {([["HP", g.hp], ["BITE", g.bite], ["SPEED", g.speed], ["ARMOR", g.armor]] as const).map(([k, v]) => (
              <div key={k} className="rounded border border-border px-1.5 py-1"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <p className="text-muted-foreground">{g.ability}</p>
          <div className="grid gap-1.5">
            {isGuardianOwner(g, [wallet?.ordinalsAddress, wallet?.paymentAddress]) ? (
              <button type="button" className="btn-term" onClick={() => { mountGuardian(g); playSfx("beast"); }}>MOUNT YOUR GUARDIAN</button>
            ) : (
              <p className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground">MOUNT · OWNER ONLY · SUMMONED BY {g.owner.slice(0, 6)}…{g.owner.slice(-4)}{address ? "" : " · CONNECT WALLET"}</p>
            )}
            <button type="button" className="btn-term-ghost" onClick={() => requestRoar(g.height)}>HEAR ITS ROAR</button>
            <button type="button" className="btn-term" disabled={busy} onClick={tribute}>
              {busy ? "OFFERING…" : `OFFER ${TRIBUTE_BIT} BIT · SOVEREIGN STRIDE (10 MIN)`}
            </button>
            <button type="button" className="btn-term-ghost" onClick={() => { setNote(null); startSpar(g); }}>CHALLENGE TO A FRIENDLY SPAR</button>
          </div>
          <p className="text-[10px] text-muted-foreground">SPARS ARE NON-LETHAL: NEITHER SIDE FALLS BELOW 1 HP.</p>
          {note && <p className="text-bitcoin">{note}</p>}
        </div>
      )}

      {s && (
        <div className="hud-panel pointer-events-auto absolute right-3 top-24 w-[min(16rem,calc(100%-1.5rem))] space-y-2 p-3 text-[10px]" aria-label="Spar">
          <p className="label text-bitcoin">{s.over ? (s.over === "won" ? "SPAR WON" : "SPAR YIELDED") : "● FRIENDLY SPAR"}</p>
          <SparBar label="YOU" v={s.you} max={SPAR_PLAYER_HP} tone="bg-signal" />
          <SparBar label="GUARDIAN" v={s.guardian} max={s.guardianMax} tone="bg-bitcoin" />
          <ul className="max-h-28 space-y-0.5 overflow-hidden">
            {s.log.map((l) => (
              <li key={l.id} className={l.tone === "hit" ? "text-signal" : l.tone === "hurt" ? "text-bitcoin" : "text-foreground"}>{l.text}</li>
            ))}
          </ul>
          <div className="flex gap-1">
            {!s.over && <button type="button" className="btn-term flex-1" onClick={strike}><span className="hidden md:inline">[F] </span>STRIKE</button>}
            <button type="button" className="btn-term-ghost flex-1" onClick={endSpar}>{s.over ? "CLOSE" : "STOP"}</button>
          </div>
          {note && !s.over && <p className="text-muted-foreground">{note}</p>}
        </div>
      )}
    </div>
  );
}

function SparBar({ label, v, max, tone }: { label: string; v: number; max: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{v}/{max}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-muted"><div className={`h-full ${tone} transition-all duration-300`} style={{ width: `${(v / max) * 100}%` }} /></div>
    </div>
  );
}
