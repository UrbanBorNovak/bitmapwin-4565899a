import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { COIN, formatBit, type CoinEventKind } from "@/lib/coins";
import { createEventFn } from "@/lib/coins.functions";
import { useWalletSession } from "@/lib/wallet-session";

const KINDS: { value: CoinEventKind; label: string }[] = [
  { value: "raffle", label: "RAFFLE" },
  { value: "giveaway", label: "GIVEAWAY" },
  { value: "event", label: "EVENT" },
];

/**
 * Raffle builder: a holder or lessee sets the BIT prize pot and the BIT ticket
 * price. The prize is locked out of the host's balance the moment it goes live,
 * so the winner is always paid.
 */
export function CoinEventForm({
  defaultHeight,
  lockHeight = false,
  defaultKind = "raffle",
}: {
  defaultHeight?: number;
  lockHeight?: boolean;
  defaultKind?: CoinEventKind;
}) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CoinEventKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [prizeCoins, setPrizeCoins] = useState("500");
  const [prize, setPrize] = useState("");
  const [description, setDescription] = useState("");
  const [entryCost, setEntryCost] = useState("50");
  const [maxEntries, setMaxEntries] = useState("");
  const [height, setHeight] = useState(defaultHeight ? String(defaultHeight) : "");
  const [endsAt, setEndsAt] = useState("");

  const pot = Math.max(0, Math.round(Number(prizeCoins) || 0));
  const ticket = Math.max(0, Math.round(Number(entryCost) || 0));

  const create = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT UNISAT OR XVERSE FIRST");
      if (title.trim().length < 3) throw new Error("GIVE IT A TITLE");
      const max = maxEntries.trim() ? Math.max(1, Math.round(Number(maxEntries))) : null;
      const bitmapHeight = height.trim() ? Math.round(Number(height)) : null;
      if (bitmapHeight !== null && !Number.isFinite(bitmapHeight)) {
        throw new Error("BITMAP HEIGHT MUST BE A NUMBER");
      }
      if (pot === 0 && !prize.trim()) throw new Error("SET A BIT PRIZE OR DESCRIBE ONE");
      return createEventFn({
        data: {
          kind,
          hostAddress: wallet.ordinalsAddress,
          title: title.trim(),
          bitmapHeight,
          description: description.trim() || null,
          prize: prize.trim() || null,
          prizeCoins: pot,
          entryCost: ticket,
          maxEntries: max,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["coin-events"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-ledger"] });
      setTitle("");
      setPrize("");
      setDescription("");
      toast("RAFFLE LIVE", {
        description:
          pot > 0
            ? `${formatBit(pot)} PRIZE LOCKED — TICKETS COST ${formatBit(ticket)}`
            : `TICKETS COST ${formatBit(ticket)}`,
      });
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
        placeholder="TITLE — E.G. SKYLINE RAFFLE"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2">
          <span className="label">PRIZE POT</span>
          <input
            className="w-28 border border-border bg-transparent px-3 py-2 font-mono text-xs"
            inputMode="numeric"
            aria-label={`PRIZE IN ${COIN}`}
            value={prizeCoins}
            onChange={(e) => setPrizeCoins(e.target.value)}
          />
          <span className="font-mono text-[11px] text-muted-foreground">{COIN}</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="label">TICKET</span>
          <input
            className="w-28 border border-border bg-transparent px-3 py-2 font-mono text-xs"
            inputMode="numeric"
            aria-label={`ENTRY COST IN ${COIN}`}
            value={entryCost}
            onChange={(e) => setEntryCost(e.target.value)}
          />
          <span className="font-mono text-[11px] text-muted-foreground">{COIN}</span>
        </label>
      </div>

      <input
        className="w-full border border-border bg-transparent px-3 py-2 font-mono text-xs"
        aria-label="EXTRA PRIZE"
        placeholder="EXTRA PRIZE (OPTIONAL) — E.G. 1 ORDINAL FROM MY SHOP"
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
          aria-label="MAX TICKETS"
          placeholder="MAX TICKETS"
          value={maxEntries}
          onChange={(e) => setMaxEntries(e.target.value)}
        />
        {lockHeight ? null : (
          <input
            className="w-36 border border-border bg-transparent px-3 py-2 font-mono text-xs"
            inputMode="numeric"
            aria-label="BITMAP HEIGHT"
            placeholder="BITMAP HEIGHT"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        )}
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
        {create.isPending
          ? "[ LOCKING PRIZE… ]"
          : pot > 0
            ? `[ HOST IT · LOCK ${formatBit(pot)} ]`
            : "[ HOST IT ]"}
      </button>
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt;{" "}
        {wallet
          ? `THE ${COIN} PRIZE LEAVES YOUR BALANCE NOW AND IS PAID TO THE WINNER ON THE DRAW — CLOSE WITHOUT DRAWING AND IT COMES BACK`
          : "CONNECT A WALLET TO HOST"}
        <span className="blink">_</span>
      </p>
    </div>
  );
}
