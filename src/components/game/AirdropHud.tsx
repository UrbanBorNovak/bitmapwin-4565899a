/**
 * SATELLITE POD HUD — the race prompt and the payout.
 *
 * Shows where the current block's pod landed and how far you are from it.
 * Standing on it salvages the pod: the server pays the BIT, once per account
 * per pod, and the pod stays claimed on this device.
 */
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { claimAirdropFn } from "@/lib/airdrop.functions";
import { airdropFor, isAirdropClaimed, markAirdropClaimed } from "@/lib/oasis-airdrop";
import { colAt, rowAt } from "@/lib/player-state";
import { useWalletSession } from "@/lib/wallet-session";
import { playSfx } from "@/lib/world-audio";

type Pose = { height: number; x: number; z: number };

export function AirdropHud({ pose, unit, block }: { pose: MutableRefObject<Pose>; unit: number; block: number }) {
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  const claim = useServerFn(claimAirdropFn);
  const qc = useQueryClient();
  const busy = useRef(false);
  const [state, setState] = useState<{ key: string; height: number; bit: number; distance: number; claimed: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!block) return;
    const id = window.setInterval(() => {
      const p = pose.current;
      const drop = airdropFor(block, colAt(p.x), rowAt(p.z));
      if (!drop) return setState(null);
      const distance = Math.hypot(drop.x - p.x, drop.z - p.z);
      const claimed = isAirdropClaimed(drop.key);
      setState({ key: drop.key, height: drop.height, bit: drop.bit, distance, claimed });
      if (!claimed && distance <= unit * 12 && !busy.current) void salvage(drop.key, drop.bit);
    }, 900);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, unit, block, address]);

  async function salvage(key: string, bit: number) {
    if (busy.current) return;
    if (!address) {
      setNote("CONNECT A VERIFIED WALLET TO SALVAGE");
      return;
    }
    busy.current = true;
    try {
      const res = await claim({ data: { address, key } });
      if (!res.ok) {
        setNote(res.error);
        return;
      }
      markAirdropClaimed(key);
      playSfx("levelup");
      setNote(res.already ? "POD ALREADY SALVAGED" : `POD SALVAGED · +${bit} BIT`);
      void qc.invalidateQueries();
    } catch {
      setNote("SIGN IN AND VERIFY YOUR WALLET TO SALVAGE");
    } finally {
      busy.current = false;
      window.setTimeout(() => setNote(null), 5000);
    }
  }

  if (!state) return null;
  const strides = Math.round(state.distance / unit);
  return (
    <div
      data-no-translate
      className="hud-panel absolute left-3 top-24 z-30 w-[min(13.5rem,calc(100%-1.5rem))] px-2.5 py-2 font-mono text-[10px]"
      aria-label="Satellite pod"
    >
      <span className="hud-telemetry-title">{state.claimed ? "POD SALVAGED" : "SATELLITE POD INBOUND"}</span>
      <p className="text-bitcoin">{state.height.toLocaleString("en-US")}.BITMAP</p>
      <p className="text-foreground">{state.claimed ? "NEXT POD ON THE NEXT BLOCK" : `${strides.toLocaleString("en-US")} STRIDES · ${state.bit} BIT`}</p>
      {note ? <p className="mt-1 text-signal">{note}</p> : null}
    </div>
  );
}
