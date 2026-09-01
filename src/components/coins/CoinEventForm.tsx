import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createCoinEvent, type CoinEventKind } from "@/lib/coins";
import { useWalletSession } from "@/lib/wallet-session";

const KINDS: { value: CoinEventKind; label: string }[] = [
  { value: "raffle", label: "RAFFLE" },
  { value: "giveaway", label: "GIVEAWAY" },
  { value: "event", label: "EVENT" },
];

/**
 * Host form: builders spin up a BIT-priced raffle, giveaway or ticketed event
 * on a bitmap they hold or lease.
 */
export function CoinEventForm({ defaultHeight }: { defaultHeight?: number }) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CoinEventKind>("raffle");
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [description, setDescription] = useState("");
  const [entryCost, setEntryCost] = useState("50");
  const [maxEntries, setMaxEntries] = useState("");
  const [height, setHeight] = useState(defaultHeight ? String(defaultHeight) : "");
  const [endsAt, setEndsAt] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT UNISAT OR XVERSE FIRST");
      if (!title.trim()) throw new Error("GIVE IT A TITLE");
      const cost = Math.max(0, Math.round(Number(entryCost) || 0));
      const max = maxEntries.trim() ? Math.max(1, Math.round(Number(maxEntries))) : null;
      const bitmapHeight = height.trim() ? Math.round(Number(height)) : null;
      if (bitmapHeight !== null && !Number.isFinite(bitmapHeight)) {
        throw new Error("BITMAP HEIGHT MUST BE A NUMBER");
      }
      await createCoinEvent({
        kind,
        bitmapHeight,
        hostAddress: wallet.ordinalsAddress,
        title: title.trim(),
        description: description.trim() || null,
        prize: prize.trim() || null,
        entryCost: cost,
        maxEntries: max,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["coin-events"] });
      setTitle("");
      setPrize("");
      setDescription("");
      toast("EVENT LIVE", { description: "ENTRANTS PAY IN BIT — THE COINS LAND IN YOUR BALANCE" });
    },
    onError: (e) => toast("COULD NOT CREATE", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            className={`btn-term !px-3 !py-1.5 ${kind === k.value ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => setKind(k.value)}
          >
            [ {k.label} ]
          </button>
        ))}
      </div>

      <input
        className="w-full border border-border bg-transparent px-3 py-2 font-mono text-xs"
        aria-label="TITLE"
        placeholder="TITLE — E.G. BLOCK 840000 SKYLINE RAFFLE"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="w-full border border-border bg-transparent px-3 py-2 font-mono text-xs"
        aria-label="PRIZE"
        placeholder="PRIZE — E.G. 1 ORDINAL FROM MY SHOP"
        value={prize}
        onChange={(e) => setPrize(e.target.value)}
      />
      <textarea
        className="w-full border border-border bg-transparent px-3 py-2 font-mono text-xs"
        rows={3}
        aria-label="DESCRIPTION"
        placeholder="RULES, DATE, WHAT ENTRANTS GET"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <input
          className="w-32 border border-border bg-transparent px-3 py-2 font-mono text-xs"
          inputMode="numeric"
          aria-label="ENTRY COST IN BIT"
          placeholder="ENTRY BIT"
          value={entryCost}
          onChange={(e) => setEntryCost(e.target.value)}
        />
        <input
          className="w-32 border border-border bg-transparent px-3 py-2 font-mono text-xs"
          inputMode="numeric"
          aria-label="MAX TICKETS"
          placeholder="MAX TICKETS"
          value={maxEntries}
          onChange={(e) => setMaxEntries(e.target.value)}
        />
        <input
          className="w-36 border border-border bg-transparent px-3 py-2 font-mono text-xs"
          inputMode="numeric"
          aria-label="BITMAP HEIGHT"
          placeholder="BITMAP HEIGHT"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
        <input
          className="border border-border bg-transparent px-3 py-2 font-mono text-xs"
          type="datetime-local"
          aria-label="ENDS AT"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="btn-term !px-3 !py-1.5"
        disabled={create.isPending || !wallet}
        onClick={() => create.mutate()}
      >
        {create.isPending ? "[ CREATING… ]" : "[ HOST IT ]"}
      </button>
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; {wallet ? "ONLY VERIFIED ADDRESSES CAN HOST — LINK YOUR WALLET ON /WALLET" : "CONNECT A WALLET TO HOST"}
        <span className="blink">_</span>
      </p>
    </div>
  );
}
