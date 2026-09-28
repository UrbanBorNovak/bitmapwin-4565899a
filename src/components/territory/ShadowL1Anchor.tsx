import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resolveWallet } from "@/components/BuyButton";
import { WALLET_LABEL, keyCandidates, signPurchasePsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import {
  getShadowNoteFn,
  quoteShadowGateNoteFn,
  quoteShadowNoteFn,
  submitShadowGateNoteFn,
  submitShadowNoteFn,
} from "@/lib/shadow-l1.functions";
import { mempoolTxUrl } from "@/lib/shadow-l1";

/**
 * Writes a shielded note straight onto Bitcoin: one ordinary transaction whose
 * first output carries the 43-byte SHAD envelope. Only a hash travels — the
 * secrets behind it never leave the holder's device.
 */
export function ShadowL1Anchor({
  op,
  slug,
  digest,
  label,
  note,
}: {
  op: "gate" | "pass";
  slug: string;
  digest: string;
  label: string;
  note?: string;
}) {
  const queryClient = useQueryClient();
  const loadNote = useServerFn(getShadowNoteFn);
  const quotePass = useServerFn(quoteShadowNoteFn);
  const quoteGate = useServerFn(quoteShadowGateNoteFn);
  const submitPass = useServerFn(submitShadowNoteFn);
  const submitGate = useServerFn(submitShadowGateNoteFn);

  const anchored = useQuery({
    queryKey: ["shadow-note", digest],
    queryFn: () => loadNote({ data: { digest } }),
    staleTime: 20_000,
  });

  const write = useMutation({
    mutationFn: async () => {
      const wallet = await resolveWallet();
      const tapKey = xOnlyPubKeyHex(wallet.publicKey);
      const keys = keyCandidates(wallet);
      const base = {
        slug,
        digest,
        payerAddress: wallet.paymentAddress,
        ...(tapKey ? { tapInternalKeyHex: tapKey } : {}),
        ...(keys.length > 0 ? { paymentPublicKeyHex: keys } : {}),
      };
      const quoted =
        op === "gate"
          ? await quoteGate({ data: base })
          : await quotePass({ data: { ...base, op: "pass" as const } });
      if (!quoted.ok) throw new Error(quoted.reason);
      const q = quoted.quote;
      toast(`SIGN THE NOTE IN ${WALLET_LABEL[wallet.provider]}`, {
        description: `${q.anchorSats} SATS ANCHOR + ${q.minerFeeSats} SATS MINER FEE @ ${q.feeRate} SAT/VB`,
      });
      const signed = await signPurchasePsbt(wallet.provider, q.psbtBase64, wallet.paymentAddress, q.signIndices);
      const res =
        op === "gate"
          ? await submitGate({ data: { slug, digest, psbt: signed } })
          : await submitPass({ data: { op: "pass" as const, slug, digest, psbt: signed } });
      if (!res.ok) throw new Error(res.reason ?? "BITCOIN REFUSED THE NOTE");
      return res.txid!;
    },
    onSuccess: (txid) => {
      void queryClient.invalidateQueries({ queryKey: ["shadow-note", digest] });
      void queryClient.invalidateQueries({ queryKey: ["shadow-notes", slug] });
      toast.success("SHIELDED NOTE BROADCAST TO BITCOIN", { description: `TXID ${txid.slice(0, 16)}…` });
    },
    onError: (e) => toast.error("NOTE NOT WRITTEN", { description: (e as Error).message.toUpperCase() }),
  });

  const existing = anchored.data;

  if (existing) {
    return (
      <div className="border border-bitcoin/50 bg-bitcoin/5 px-3 py-2">
        <p className="label text-bitcoin">
          ◆ ON BITCOIN · {existing.status === "confirmed" ? `BLOCK ${existing.confirmedHeight ?? "—"}` : "IN THE MEMPOOL"}
        </p>
        <a
          href={mempoolTxUrl(existing.txid)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all font-mono text-[10px] text-muted-foreground underline"
        >
          {existing.txid}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={write.isPending || anchored.isLoading}
        onClick={() => write.mutate()}
        className="w-full border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background disabled:opacity-40"
      >
        {write.isPending ? "WRITING TO BITCOIN…" : label}
      </button>
      {note ? <p className="label text-muted-foreground">{note}</p> : null}
    </div>
  );
}
