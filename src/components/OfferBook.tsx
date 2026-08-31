import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { offersQuery, OFFER_STATUS_LABEL, type Offer } from "@/lib/offers";
import { inspectOfferFn, refreshOffersFn, submitOfferFn } from "@/lib/offers.functions";
import { BuyButton } from "@/components/BuyButton";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";



/**
 * PSBT offer book: sellers paste or upload a signed sale PSBT, everyone else
 * reads the open offers and takes the raw PSBT to their own wallet.
 */
export function OfferBook({ height }: { height?: number }) {
  const queryClient = useQueryClient();
  const { data: offers = [], isLoading } = useQuery(offersQuery(height));
  const [psbt, setPsbt] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["offers"] });

  const inspect = useMutation({
    mutationFn: () => inspectOfferFn({ data: { psbt } }),
    onSuccess: (r) =>
      toast(`OFFER READS ${r.bitmapHeight}.BITMAP`, {
        description: `${formatSats(r.priceSats)} · SELLER ${shortenAddress(r.sellerAddress)} · ${r.inputs} IN / ${r.outputs} OUT`,
      }),
    onError: (e) => toast("PSBT REJECTED", { description: (e as Error).message }),
  });

  const submit = useMutation({
    mutationFn: () => submitOfferFn({ data: { psbt } }),
    onSuccess: (r) => {
      invalidate();
      setPsbt("");
      toast(r.duplicate ? "OFFER ALREADY IN THE BOOK" : `OFFER ACCEPTED — ${r.bitmapHeight}.BITMAP`, {
        description: `${formatSats(r.priceSats)} · UTXO ${r.outpoint.slice(0, 12)}… · ${r.status.toUpperCase()}`,
      });
    },
    onError: (e) => toast("OFFER REJECTED", { description: (e as Error).message }),
  });

  const refresh = useMutation({
    mutationFn: () => refreshOffersFn({ data: { limit: 40 } }),
    onSuccess: (r) => {
      invalidate();
      toast(`CHECKED ${r.checked} OFFER(S)`, { description: `${r.spent} UTXO(S) NOW SPENT` });
    },
    onError: (e) => toast("STATUS CHECK FAILED", { description: (e as Error).message }),
  });

  const open = useMemo(() => offers.filter((o) => o.status === "open"), [offers]);
  const busy = inspect.isPending || submit.isPending || refresh.isPending;

  const readFile = async (file: File) => {
    const text = await file.text();
    setPsbt(text.trim());
  };

  return (
    <section className="mt-12 border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-6">
        <div>
          <h2 className="display text-2xl">PSBT OFFER BOOK</h2>
          <p className="label mt-2">
            SIGNED SALE TRANSACTIONS {height === undefined ? "ACROSS THE REGISTRY" : `FOR ${height}.BITMAP`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="label">OPEN {open.length}</span>
          <button className="btn-term-ghost" disabled={busy} onClick={() => refresh.mutate()}>
            {refresh.isPending ? "[ CHECKING… ]" : "[ CHECK UTXOS ]"}
          </button>
        </div>
      </header>

      <div className="border-b border-border p-6">
        <label className="label" htmlFor="psbt-input">
          SUBMIT OFFER — BASE64 PSBT
        </label>
        <textarea
          id="psbt-input"
          value={psbt}
          onChange={(e) => setPsbt(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="cHNidP8BA…"
          className="mt-2 w-full resize-y border border-border bg-background p-3 font-mono text-[11px] break-all text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="btn-term"
            disabled={busy || psbt.trim() === ""}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "[ VALIDATING… ]" : "[ SUBMIT OFFER ]"}
          </button>
          <button
            className="btn-term-ghost"
            disabled={busy || psbt.trim() === ""}
            onClick={() => inspect.mutate()}
          >
            {inspect.isPending ? "[ READING… ]" : "[ DECODE ONLY ]"}
          </button>
          <button className="btn-term-ghost" onClick={() => fileInput.current?.click()}>
            [ LOAD .PSBT ]
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".psbt,.txt,.b64"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">
          &gt; THE PSBT MUST SPEND A UTXO HOLDING A &lt;HEIGHT&gt;.BITMAP INSCRIPTION. VALIDATED AGAINST
          THE LIVE UTXO SET. API: POST /api/public/offer · GET /api/public/offers
        </p>
      </div>

      {isLoading ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">
          &gt; LOADING OFFERS<span className="blink">_</span>
        </p>
      ) : offers.length === 0 ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">
          &gt; NO OFFERS SUBMITTED YET<span className="blink">_</span>
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {offers.map((offer) => (
            <OfferRow key={offer.id} offer={offer} showLink={height === undefined} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OfferRow({ offer, showLink }: { offer: Offer; showLink: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="display text-sm">
          {offer.bitmapHeight === null ? "UNKNOWN PARCEL" : `${offer.bitmapHeight}.BITMAP`}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-sm">{formatSats(offer.priceSats)}</span>
          <span className="label">{OFFER_STATUS_LABEL[offer.status]}</span>
        </div>
      </div>
      <dl className="mt-3 grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <div>SELLER {shortenAddress(offer.sellerAddress)}</div>
        <div className="break-all">UTXO {offer.outpoint}</div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {offer.status === "open" && <BuyButton offer={offer} />}
        <button className="btn-term-ghost !px-3 !py-1.5" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "HIDE PSBT" : "SHOW PSBT"}
        </button>

        <button
          className="btn-term-ghost !px-3 !py-1.5"
          onClick={() => {
            void navigator.clipboard.writeText(offer.psbtBase64);
            toast("PSBT COPIED", { description: "TAKE IT TO YOUR WALLET TO SIGN AND BROADCAST" });
          }}
        >
          COPY PSBT
        </button>
        {showLink && offer.bitmapHeight !== null && (
          <Link
            to="/bitmap/$block"
            params={{ block: String(offer.bitmapHeight) }}
            className="btn-term-ghost !px-3 !py-1.5"
          >
            VIEW PARCEL
          </Link>
        )}
      </div>
      {expanded && (
        <pre className="mt-3 max-h-48 overflow-auto border border-border p-3 font-mono text-[10px] break-all whitespace-pre-wrap">
          {offer.psbtBase64}
        </pre>
      )}
    </li>
  );
}

