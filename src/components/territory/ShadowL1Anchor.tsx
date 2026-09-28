import { useCallback } from "react";
import { useState } from "react";
import { useMempoolWatch } from "@/lib/use-mempool-watch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resolveWallet } from "@/components/BuyButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WALLET_LABEL, keyCandidates, signPurchasePsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import {
  getShadowNoteFn,
  quoteShadowGateNoteFn,
  quoteShadowNoteFn,
  submitShadowGateNoteFn,
  submitShadowNoteFn,
} from "@/lib/shadow-l1.functions";
import { mempoolTxUrl } from "@/lib/shadow-l1";
import { SHADOW_OP_LABEL, decodeShadowNote } from "@/lib/shadow-wire";
import type { ShadowNoteQuote } from "@/lib/shadow-l1.server";

/**
 * Writes a shielded note straight onto Bitcoin: one ordinary transaction whose
 * first output carries the 43-byte SHAD envelope. Only a hash travels — the
 * secrets behind it never leave the holder's device.
 *
 * The payer sees the exact cost and the exact bytes before signing, then the
 * signed transaction itself, then the block that mined it.
 */

const sats = (n: number) => n.toLocaleString("en-US");

function Row({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5">
      <span className="label shrink-0 text-muted-foreground">{k}</span>
      <span className={`break-all text-right font-mono text-[11px] ${tone || "text-foreground"}`}>{v}</span>
    </div>
  );
}

/** Reads the 43-byte envelope back apart so the payer can check every field. */
function PayloadInspector({ payloadHex }: { payloadHex: string }) {
  const note = decodeShadowNote(payloadHex);
  return (
    <div className="border border-signal/30 bg-signal/5 p-2">
      <p className="label mb-1 text-signal">◈ THE 43 BYTES GOING ONTO BITCOIN</p>
      <p className="break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
        <span className="text-bitcoin">{payloadHex.slice(0, 8)}</span>
        <span className="text-signal">{payloadHex.slice(8, 10)}</span>
        <span className="text-foreground">{payloadHex.slice(10, 18)}</span>
        <span className="text-signal">{payloadHex.slice(18, 22)}</span>
        <span className="text-muted-foreground">{payloadHex.slice(22)}</span>
      </p>
      {note ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 font-mono text-[10px]">
          <span className="text-muted-foreground">MARK</span>
          <span className="text-bitcoin">SHAD</span>
          <span className="text-muted-foreground">KIND</span>
          <span className="text-signal">{SHADOW_OP_LABEL[note.op]}</span>
          <span className="text-muted-foreground">LAND</span>
          <span className="text-foreground">{note.height}.BITMAP</span>
          <span className="text-muted-foreground">SLOT</span>
          <span className="text-foreground">#{note.index}</span>
        </div>
      ) : null}
      <p className="label mt-2 text-muted-foreground">
        THE LAST 32 BYTES ARE A ONE-WAY FINGERPRINT. YOUR SECRET NEVER LEAVES THIS DEVICE.
      </p>
    </div>
  );
}

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

  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<ShadowNoteQuote | null>(null);
  const [signed, setSigned] = useState<{ txid: string; rawHex: string; rawBytes: number } | null>(null);

  const anchored = useQuery({
    queryKey: ["shadow-note", digest],
    queryFn: () => loadNote({ data: { digest } }),
    staleTime: 20_000,
  });

  const existing = anchored.data;
  const waiting = existing?.status === "broadcast";
  // live mempool websocket: re-read the note the moment a block carries it
  const refreshNote = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["shadow-note"] });
    void queryClient.invalidateQueries({ queryKey: ["shadow-notes", slug] });
  }, [queryClient, slug]);
  useMempoolWatch(waiting ? existing?.txid : null, refreshNote);

  /** Step 1 — price the transaction against the payer's real coins. */
  const price = useMutation({
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
      return { quote: quoted.quote as ShadowNoteQuote, provider: wallet.provider };
    },
    onSuccess: ({ quote: q }) => {
      setQuote(q);
      setSigned(null);
      setOpen(true);
    },
    onError: (e) => toast.error("COULD NOT PRICE THE NOTE", { description: (e as Error).message.toUpperCase() }),
  });

  /** Step 2 — the payer signs, we verify the bytes, Bitcoin takes it. */
  const write = useMutation({
    mutationFn: async () => {
      if (!quote) throw new Error("NO QUOTE TO SIGN");
      const wallet = await resolveWallet();
      const signedPsbt = await signPurchasePsbt(
        wallet.provider,
        quote.psbtBase64,
        wallet.paymentAddress,
        quote.signIndices,
      );
      const res =
        op === "gate"
          ? await submitGate({ data: { slug, digest, psbt: signedPsbt } })
          : await submitPass({ data: { op: "pass" as const, slug, digest, psbt: signedPsbt } });
      if (!res.ok) throw new Error(res.reason ?? "BITCOIN REFUSED THE NOTE");
      return { txid: res.txid!, rawHex: res.rawHex ?? "", rawBytes: res.rawBytes ?? 0 };
    },
    onSuccess: (result) => {
      setSigned(result);
      void queryClient.invalidateQueries({ queryKey: ["shadow-note", digest] });
      void queryClient.invalidateQueries({ queryKey: ["shadow-notes", slug] });
      toast.success("SHIELDED NOTE BROADCAST TO BITCOIN", { description: `TXID ${result.txid.slice(0, 16)}…` });
    },
    onError: (e) => toast.error("NOTE NOT WRITTEN", { description: (e as Error).message.toUpperCase() }),
  });

  const confirmed = existing?.status === "confirmed";

  return (
    <>
      {existing ? (
        <div className={`border px-3 py-2 ${confirmed ? "border-bitcoin/50 bg-bitcoin/5" : "border-signal/40 bg-signal/5"}`}>
          <p className={`label ${confirmed ? "text-bitcoin" : "text-signal"}`}>
            {confirmed ? (
              <>◆ ON BITCOIN · MINED IN BLOCK {existing.confirmedHeight ?? "—"}</>
            ) : (
              <>◈ WAITING FOR A MINER · IN THE MEMPOOL</>
            )}
          </p>
          {waiting ? (
            <p className="label mt-1 animate-pulse text-muted-foreground">
              CHECKING BITCOIN EVERY 15 SECONDS — THIS PAGE UPDATES ITSELF
            </p>
          ) : null}
          <a
            href={mempoolTxUrl(existing.txid)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all font-mono text-[10px] text-muted-foreground underline"
          >
            {existing.txid}
          </a>
          {signed?.rawHex ? (
            <details className="mt-2">
              <summary className="label cursor-pointer text-muted-foreground hover:text-signal">
                SHOW THE SIGNED TRANSACTION · {sats(signed.rawBytes)} BYTES
              </summary>
              <p className="mt-1 max-h-32 overflow-y-auto break-all font-mono text-[9px] text-muted-foreground">
                {signed.rawHex}
              </p>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            disabled={price.isPending || anchored.isLoading}
            onClick={() => price.mutate()}
            className="w-full border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background disabled:opacity-40"
          >
            {price.isPending ? "READING THE FEE…" : label}
          </button>
          {note ? <p className="label text-muted-foreground">{note}</p> : null}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !write.isPending && setOpen(v)}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto border-signal/40 bg-background">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-signal">
              {signed ? "◆ WRITTEN ONTO BITCOIN" : "◈ WRITE THIS PASS ONTO BITCOIN"}
            </DialogTitle>
            <DialogDescription className="label text-muted-foreground">
              {signed
                ? "THE TRANSACTION IS ON THE NETWORK. THE VAULT MARKS IT THE MOMENT A MINER TAKES IT."
                : "ONE ORDINARY BITCOIN TRANSACTION. CHECK THE COST AND THE BYTES, THEN SIGN."}
            </DialogDescription>
          </DialogHeader>

          {quote && !signed ? (
            <div className="space-y-3">
              <div className="border border-bitcoin/40 bg-bitcoin/5 p-2">
                <p className="label text-bitcoin">WHAT THIS COSTS YOU</p>
                <Row k="MINER FEE" v={`${sats(quote.minerFeeSats)} SATS`} />
                <Row k="FEE RATE" v={`${quote.feeRate} SAT/VB · ~${sats(quote.estimatedVBytes)} VB`} />
                <Row k="TERRITORY ANCHOR" v={`${sats(quote.anchorSats)} SATS`} />
                <div className="flex items-baseline justify-between gap-3 pt-1.5">
                  <span className="label text-bitcoin">TOTAL</span>
                  <span className="font-mono text-base text-bitcoin">{sats(quote.totalSats)} SATS</span>
                </div>
              </div>

              <PayloadInspector payloadHex={quote.payloadHex} />

              <div className="border border-border/60 p-2">
                <p className="label mb-1 text-muted-foreground">THE TRANSACTION</p>
                <Row k="COINS SPENT" v={`${quote.inputCount} · ${sats(quote.fundedSats)} SATS`} />
                <Row k="OUTPUT 0" v="THE SHIELDED NOTE · 0 SATS" tone="text-signal" />
                <Row k="OUTPUT 1" v={`ANCHOR → ${quote.treasury.slice(0, 10)}…${quote.treasury.slice(-6)}`} />
                <Row k="OUTPUT 2" v={`CHANGE BACK TO YOU · ${sats(quote.changeSats)} SATS`} />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={write.isPending}
                  className="flex-1 border border-border px-3 py-2 font-mono text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => write.mutate()}
                  disabled={write.isPending}
                  className="flex-[2] border border-bitcoin bg-bitcoin/10 px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background disabled:opacity-40"
                >
                  {write.isPending ? "WAITING FOR YOUR WALLET…" : `SIGN & SEND · ${sats(quote.totalSats)} SATS`}
                </button>
              </div>
              <p className="label text-muted-foreground">
                YOUR WALLET SIGNS THIS ITSELF. WE NEVER HOLD YOUR COINS, AND WE REFUSE TO SEND IT IF A SINGLE BYTE CHANGED.
              </p>
            </div>
          ) : null}

          {signed ? (
            <div className="space-y-3">
              <div className="border border-bitcoin/40 bg-bitcoin/5 p-2">
                <p className="label text-bitcoin">◆ SIGNED & BROADCAST</p>
                <Row k="TRANSACTION" v={signed.txid} tone="text-bitcoin" />
                <Row k="SIZE" v={`${sats(signed.rawBytes)} BYTES`} />
                <Row
                  k="STATUS"
                  v={confirmed ? `MINED IN BLOCK ${existing?.confirmedHeight ?? "—"}` : "IN THE MEMPOOL · WAITING FOR A MINER"}
                  tone={confirmed ? "text-bitcoin" : "text-signal"}
                />
              </div>

              <div className="border border-border/60 p-2">
                <p className="label mb-1 text-muted-foreground">THE SIGNED TRANSACTION, EXACTLY AS SENT</p>
                <p className="max-h-40 overflow-y-auto break-all font-mono text-[9px] text-muted-foreground">
                  {signed.rawHex || "—"}
                </p>
              </div>

              <div className="border border-signal/30 bg-signal/5 p-2">
                <p className="label text-signal">
                  {confirmed
                    ? "◆ THE VAULT NOW SHOWS THIS PASS AS ANCHORED ON BITCOIN."
                    : "◈ THE VAULT WILL MARK THIS PASS ANCHORED AS SOON AS A BLOCK CARRIES IT."}
                </p>
                {!confirmed ? (
                  <p className="label mt-1 animate-pulse text-muted-foreground">CHECKING BITCOIN EVERY 15 SECONDS…</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <a
                  href={mempoolTxUrl(signed.txid)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 border border-signal/50 px-3 py-2 text-center font-mono text-xs text-signal hover:bg-signal/15"
                >
                  VIEW ON MEMPOOL
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-border px-3 py-2 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  DONE
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
