import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MakeOfferButton } from "@/components/MakeOfferButton";
import { WatchBitmapButton } from "@/components/WatchBitmapButton";
import { BUILD_KINDS, BUILD_KIND_LABELS, type BuildKind } from "@/lib/build-sdk";
import { fetchParcelPage, saveParcelPage } from "@/lib/profiles";
import { upsertLeaseOffer } from "@/lib/leases";
import { useWalletSession } from "@/lib/wallet-session";
import type { ManagerSuggestion } from "@/lib/manager-ai.functions";

/**
 * Turns one BITMAP MANAGER suggestion into the real action it describes:
 * place a signed bid, submit/refresh a build, or re-list (renew) a lease.
 */
export function ManagerSuggestionAction({
  suggestion,
  held,
  topBidSats,
}: {
  suggestion: ManagerSuggestion;
  held: boolean;
  topBidSats: number | null;
}) {
  const height = suggestion.height;
  if (height === null) return null;

  if (suggestion.kind === "watch") return <WatchBitmapButton height={height} />;

  if (suggestion.kind === "bid") {
    const suggested = topBidSats && topBidSats > 0 ? Math.round(topBidSats * 1.1) : null;
    return (
      <MakeOfferButton
        height={height}
        topBidSats={topBidSats}
        className="btn-term-ghost !px-3 !py-1.5 !text-[11px]"
        label={held ? "COUNTER WITH AN OFFER" : "PLACE A BID"}
        {...(suggested ? { defaultAmountSats: suggested } : {})}
        initialNote={suggestion.title}
      />
    );
  }

  if (suggestion.kind === "build") return <BuildAction height={height} />;
  if (suggestion.kind === "lease") return <LeaseAction height={height} />;
  return null;
}

function useOwnerAddress(): string | null {
  const wallet = useWalletSession();
  if (!wallet) return null;
  return wallet.ordinalsAddress || wallet.paymentAddress || null;
}

function BuildAction({ height }: { height: number }) {
  const owner = useOwnerAddress();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<BuildKind>("info");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!owner) throw new Error("CONNECT UNISAT OR XVERSE ON /WALLET FIRST");
      if (!title.trim()) throw new Error("GIVE THE BUILD A TITLE");
      const existing = await fetchParcelPage(height);
      await saveParcelPage({
        bitmapHeight: height,
        ownerAddress: owner,
        title: title.trim(),
        description: description.trim() || null,
        linkUrl: existing?.linkUrl ?? null,
        bannerInscriptionId: existing?.bannerInscriptionId ?? null,
        buildKind: kind,
        ...(existing && existing.buildKind === kind ? { buildConfig: existing.buildConfig } : {}),
      });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["builds"] });
      void client.invalidateQueries({ queryKey: ["portfolio-activity"] });
      setOpen(false);
      toast(`BUILD LIVE — ${height}.BITMAP`, { description: "OPEN THE BITMAP TO KEEP EDITING IT" });
    },
    onError: (e: Error) => toast("BUILD FAILED", { description: e.message.toUpperCase() }),
  });

  if (!open) {
    return (
      <button type="button" className="btn-term-ghost !px-3 !py-1.5 !text-[11px]" onClick={() => setOpen(true)}>
        SUBMIT BUILD
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 border border-border p-3">
      <div className="flex flex-wrap gap-1">
        {BUILD_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`label border px-2 py-1 ${k === kind ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {BUILD_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="BUILD TITLE"
        maxLength={80}
        className="w-full border border-border bg-transparent px-2 py-1.5 font-mono text-[11px] outline-none focus:border-primary"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="WHAT VISITORS SEE FIRST"
        maxLength={400}
        rows={2}
        className="w-full border border-border bg-transparent px-2 py-1.5 font-mono text-[11px] outline-none focus:border-primary"
      />
      {!owner ? (
        <p className="font-mono text-[11px] text-primary">&gt; CONNECT A WALLET ON /WALLET FIRST_</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-term !px-3 !py-1.5 !text-[11px]"
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? "SAVING…" : "PUBLISH BUILD"}
        </button>
        <button
          type="button"
          className="btn-term-ghost !px-3 !py-1.5 !text-[11px]"
          onClick={() => setOpen(false)}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

function LeaseAction({ height }: { height: number }) {
  const owner = useOwnerAddress();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState("100");
  const [minDays, setMinDays] = useState("7");
  const [maxDays, setMaxDays] = useState("30");

  const renew = useMutation({
    mutationFn: async () => {
      if (!owner) throw new Error("CONNECT UNISAT OR XVERSE ON /WALLET FIRST");
      const rateCoins = Math.round(Number(rate));
      const min = Math.round(Number(minDays));
      const max = Math.round(Number(maxDays));
      if (!Number.isFinite(rateCoins) || rateCoins < 1) throw new Error("RATE MUST BE AT LEAST 1 BIT PER DAY");
      if (!Number.isFinite(min) || min < 1) throw new Error("MIN LENGTH MUST BE AT LEAST 1 DAY");
      if (!Number.isFinite(max) || max < min) throw new Error("MAX LENGTH MUST BE ABOVE THE MIN");
      await upsertLeaseOffer({
        bitmapHeight: height,
        ownerAddress: owner,
        rateCoinsPerDay: rateCoins,
        minDays: min,
        maxDays: max,
      });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["lease-offers"] });
      void client.invalidateQueries({ queryKey: ["leases"] });
      void client.invalidateQueries({ queryKey: ["portfolio-activity"] });
      setOpen(false);
      toast(`LEASE OPEN — ${height}.BITMAP`, { description: "BUILDERS CAN RENT IT WITH BIT NOW" });
    },
    onError: (e: Error) => toast("LEASE FAILED", { description: e.message.toUpperCase() }),
  });

  if (!open) {
    return (
      <button type="button" className="btn-term-ghost !px-3 !py-1.5 !text-[11px]" onClick={() => setOpen(true)}>
        RENEW LEASE
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 border border-border p-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="label text-muted-foreground">
          BIT / DAY
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full border border-border bg-transparent px-2 py-1 font-mono text-[11px] outline-none focus:border-primary"
          />
        </label>
        <label className="label text-muted-foreground">
          MIN DAYS
          <input
            value={minDays}
            onChange={(e) => setMinDays(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full border border-border bg-transparent px-2 py-1 font-mono text-[11px] outline-none focus:border-primary"
          />
        </label>
        <label className="label text-muted-foreground">
          MAX DAYS
          <input
            value={maxDays}
            onChange={(e) => setMaxDays(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full border border-border bg-transparent px-2 py-1 font-mono text-[11px] outline-none focus:border-primary"
          />
        </label>
      </div>
      {!owner ? (
        <p className="font-mono text-[11px] text-primary">&gt; CONNECT A WALLET ON /WALLET FIRST_</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-term !px-3 !py-1.5 !text-[11px]"
          disabled={renew.isPending}
          onClick={() => renew.mutate()}
        >
          {renew.isPending ? "SAVING…" : "OPEN LEASE OFFER"}
        </button>
        <button
          type="button"
          className="btn-term-ghost !px-3 !py-1.5 !text-[11px]"
          onClick={() => setOpen(false)}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
