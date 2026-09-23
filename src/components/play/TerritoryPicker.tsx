import { useQuery } from "@tanstack/react-query";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { useWalletSession } from "@/lib/wallet-session";
import { selectBitmap } from "@/lib/game/worldState";
import type { PlayProfile } from "@/lib/game/types";

/** YOUR TERRITORY — optional; guest mode always works. */
export function TerritoryPicker({ profile }: { profile: PlayProfile }) {
  const wallet = useWalletSession();
  const addresses = wallet ? [wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean) : [];
  const held = useQuery(heldHeightsQuery(addresses));
  if (!wallet) {
    return (
      <div className="border border-border bg-card p-3">
        <p className="label text-muted-foreground">GUEST MODE</p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">Playing with starter cards. Connect a wallet to bring your own BITMAP to the table.</p>
      </div>
    );
  }
  const list = (held.data ?? []).slice(0, 40);
  return (
    <div className="border border-border bg-card p-3">
      <p className="label text-bitcoin">YOUR TERRITORY</p>
      {held.isPending ? (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">&gt; READING YOUR LAND…</p>
      ) : held.isError ? (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">BITMAP DATA UNAVAILABLE — you can still play.</p>
      ) : list.length ? (
        <>
          <p className="display mt-1 text-lg">{profile.selectedBitmap !== null ? `BITMAP #${profile.selectedBitmap}` : "CHOOSE A BITMAP"}</p>
          <select
            className="mt-2 h-10 w-full border border-border bg-background px-2 font-mono text-xs"
            value={profile.selectedBitmap ?? ""}
            onChange={(e) => selectBitmap(e.target.value === "" ? null : Number(e.target.value))}
            aria-label="Choose the BITMAP you play as"
          >
            <option value="">— none —</option>
            {list.map((h) => (
              <option key={h} value={h}>{h}.BITMAP</option>
            ))}
          </select>
        </>
      ) : (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">No indexed BITMAPs in this wallet yet — playing with starter cards.</p>
      )}
    </div>
  );
}
