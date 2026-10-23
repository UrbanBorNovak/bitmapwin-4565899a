import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { buyWearFn } from "@/lib/launch-seats.functions";
import { HAIR_LABEL, WEAR_SHOP, hairFor, type LaunchSeat } from "@/lib/launch-seats";
import { supabase } from "@/integrations/supabase/client";
import { playSfx } from "@/lib/world-audio";

/** Seat holder's BIT wardrobe: hats and snacks, bought once, newest per slot is worn. */
export function WardrobeShop({ seat }: { seat: LaunchSeat }) {
  const buy = useServerFn(buyWearFn);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const owned = new Set(seat.owned ?? []);
  const go = async (item: string) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setMsg("Sign in to pay with BIT"); return; }
    setBusy(item); setMsg(null);
    try {
      const r = await buy({ data: { address: seat.address, item } });
      if (r.ok) { try { playSfx("pick"); } catch { /* audio locked */ } setMsg("Worn!"); await qc.invalidateQueries({ queryKey: ["launch-seats"] }); }
      else setMsg(r.error);
    } catch { setMsg("Could not buy right now"); }
    setBusy(null);
  };
  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="text-[10px] text-signal">&gt; HAIR · {HAIR_LABEL[hairFor(seat.heldBitmap)]}</div>
      <div className="mt-1 text-[10px] text-signal">&gt; WARDROBE · PAY WITH BIT</div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {WEAR_SHOP.map((w) => {
          const worn = seat.hat === w.id || seat.food === w.id;
          return (
            <button key={w.id} disabled={busy !== null || owned.has(w.id)} onClick={() => go(w.id)}
              className={`rounded border px-1 py-0.5 text-left text-[10px] disabled:opacity-60 ${worn ? "border-signal text-signal" : "border-border hover:border-bitcoin"}`}>
              {w.name}<span className="block text-bitcoin">{owned.has(w.id) ? (worn ? "WORN" : "OWNED") : `${w.price} BIT`}</span>
            </button>
          );
        })}
      </div>
      {msg && <div className="mt-1 text-[10px] text-primary">{msg}</div>}
    </div>
  );
}
