import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  WALLET_ADDRESS_STORAGE_KEY,
  walletOffersQuery,
  walletQuery,
  type DeliveredOffer,
  type WalletUtxo,
} from "@/lib/wallet";
import { deliverOfferFn } from "@/lib/wallet.functions";
import { refreshOffersFn } from "@/lib/offers.functions";
import { settleOfferFn } from "@/lib/settle.functions";
import { OFFER_STATUS_LABEL } from "@/lib/offers";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";
import { WalletConnect } from "@/components/WalletConnect";


export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Bitmap UTXOs, Inscriptions & PSBT Offers" },
      {
        name: "description",
        content:
          "Inspect any Bitcoin address: unspent outputs, the inscriptions they hold, your bitmap parcels and the PSBT offers you have sent or received.",
      },
      { property: "og:title", content: "Wallet — Bitmap UTXOs, Inscriptions & PSBT Offers" },
      {
        property: "og:description",
        content:
          "Live UTXO and inscription view for any Bitcoin address, with a PSBT offer inbox and outbox for bitmap land sales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const [input, setInput] = useState("");
  const [address, setAddress] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    const saved = window.localStorage.getItem(WALLET_ADDRESS_STORAGE_KEY);
    if (saved) {
      setInput(saved);
      setAddress(saved);
    }
  }, []);

  const wallet = useQuery(walletQuery(address));
  const offers = useQuery(walletOffersQuery(address));

  const connect = (value: string) => {
    const next = value.trim();
    if (next === "") return;
    setAddress(next);
    window.localStorage.setItem(WALLET_ADDRESS_STORAGE_KEY, next);
  };

  const disconnect = () => {
    setAddress("");
    setInput("");
    window.localStorage.removeItem(WALLET_ADDRESS_STORAGE_KEY);
  };

  const refresh = useMutation({
    mutationFn: () => refreshOffersFn({ data: { limit: 40 } }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast(`CHECKED ${r.checked} OFFER(S)`, { description: `${r.spent} UTXO(S) NOW SPENT` });
    },
    onError: (e) => toast("STATUS CHECK FAILED", { description: (e as Error).message }),
  });

  const inscribedUtxos = useMemo(
    () => (wallet.data?.utxos ?? []).filter((u) => u.inscriptions.length > 0),
    [wallet.data],
  );
  const parcels = useMemo(
    () =>
      inscribedUtxos.flatMap((u) =>
        u.inscriptions
          .filter((i) => i.bitmapHeight !== null)
          .map((i) => ({ ...i, outpoint: u.outpoint })),
      ),
    [inscribedUtxos],
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <p className="label">WALLET</p>
      <h1 className="display mt-4 text-4xl md:text-6xl">MY LAND</h1>
      <p className="mt-4 max-w-[70ch] font-mono text-sm text-muted-foreground">
        &gt; UNSPENT OUTPUTS, INSCRIPTIONS AND PSBT OFFERS FOR ANY BITCOIN ADDRESS, READ LIVE FROM THE
        ORD INDEX<span className="blink">_</span>
      </p>

      <form
        className="mt-8 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          connect(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          placeholder="bc1p… PASTE YOUR ORDINALS ADDRESS"
          className="flex-1 border border-border bg-background px-4 py-3 font-mono text-xs break-all text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <button className="btn-term" type="submit">
          [ LOAD WALLET ]
        </button>
        {address !== "" && (
          <button className="btn-term-ghost" type="button" onClick={disconnect}>
            [ CLEAR ]
          </button>
        )}
      </form>

      <WalletConnect
        connectedAddress={address}
        onConnect={(w) => {
          setInput(w.ordinalsAddress);
          connect(w.ordinalsAddress);
        }}
        onDisconnect={disconnect}
      />


      {address === "" ? (
        <p className="mt-10 font-mono text-xs text-muted-foreground">
          &gt; NO ADDRESS LOADED — PASTE THE ADDRESS THAT HOLDS YOUR BITMAPS<span className="blink">_</span>
        </p>
      ) : (
        <>
          <section className="mt-10 grid grid-cols-2 border border-border md:grid-cols-4">
            <Stat k="ADDRESS" v={shortenAddress(address)} />
            <Stat
              k="BALANCE"
              v={wallet.data ? formatSats(wallet.data.balanceSats) : wallet.isLoading ? "…" : "—"}
            />
            <Stat k="UTXOS" v={wallet.data ? String(wallet.data.utxoCount) : "—"} />
            <Stat k="BITMAP PARCELS" v={wallet.data ? String(parcels.length) : "—"} />
          </section>

          {wallet.isError && (
            <p className="mt-6 border border-border p-4 font-mono text-xs text-muted-foreground">
              &gt; {(wallet.error as Error).message.toUpperCase()}
            </p>
          )}

          {parcels.length > 0 && (
            <section className="mt-10 border border-border">
              <header className="border-b border-border p-5">
                <h2 className="display text-xl">MY BITMAP PARCELS</h2>
              </header>
              <ul className="divide-y divide-border">
                {parcels.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-3 p-5">
                    <Link
                      to="/bitmap/$block"
                      params={{ block: String(p.bitmapHeight) }}
                      className="display text-sm underline decoration-border underline-offset-4 hover:text-foreground"
                    >
                      {p.bitmapHeight}.BITMAP
                    </Link>
                    <span className="font-mono text-[11px] break-all text-muted-foreground">
                      {p.outpoint}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10 border border-border">
            <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-5">
              <h2 className="display text-xl">UNSPENT OUTPUTS</h2>
              <span className="label">
                {wallet.data ? `SCANNED ${wallet.data.scannedOutputs} / ${wallet.data.utxoCount}` : ""}
              </span>
            </header>
            {wallet.isLoading ? (
              <p className="p-5 font-mono text-xs text-muted-foreground">
                &gt; READING UTXO SET<span className="blink">_</span>
              </p>
            ) : (wallet.data?.utxos.length ?? 0) === 0 ? (
              <p className="p-5 font-mono text-xs text-muted-foreground">
                &gt; NO UNSPENT OUTPUTS INDEXED FOR THIS ADDRESS<span className="blink">_</span>
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {wallet.data!.utxos.map((utxo) => (
                  <UtxoRow key={utxo.outpoint} utxo={utxo} />
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10 border border-border">
            <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-5">
              <h2 className="display text-xl">OFFERS I SENT</h2>
              <button
                className="btn-term-ghost !px-3 !py-1.5"
                disabled={refresh.isPending}
                onClick={() => refresh.mutate()}
              >
                {refresh.isPending ? "CHECKING…" : "CHECK UTXOS"}
              </button>
            </header>
            <OfferList
              offers={offers.data?.outgoing ?? []}
              loading={offers.isLoading}
              empty="NO OFFERS SIGNED FROM THIS ADDRESS YET"
              renderExtra={(offer) => <DeliverForm offer={offer} />}
            />
          </section>

          <section className="mt-10 border border-border">
            <header className="border-b border-border p-5">
              <h2 className="display text-xl">PSBT INBOX — SENT TO ME</h2>
              <p className="label mt-2">SIGNED SELLER PSBTS DELIVERED TO THIS ADDRESS</p>
            </header>
            <OfferList
              offers={offers.data?.incoming ?? []}
              loading={offers.isLoading}
              empty="NO PSBT DELIVERED TO THIS ADDRESS YET"
              renderExtra={(offer) => <ClaimAction offer={offer} address={address} />}
            />
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-r border-b border-border p-5 last:border-r-0">
      <div className="label">{k}</div>
      <div className="display mt-2 text-lg break-all">{v}</div>
    </div>
  );
}

function UtxoRow({ utxo }: { utxo: WalletUtxo }) {
  return (
    <li className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] break-all">{utxo.outpoint}</span>
        <div className="flex items-center gap-4">
          <span className="display text-sm">{formatSats(utxo.valueSats)}</span>
          <span className="label">{utxo.confirmations.toLocaleString()} CONF</span>
        </div>
      </div>
      {utxo.inscriptions.length > 0 && (
        <ul className="mt-3 space-y-1">
          {utxo.inscriptions.map((ins) => (
            <li key={ins.id} className="font-mono text-[10px] break-all text-muted-foreground">
              {ins.bitmapHeight === null ? "INSCRIPTION" : `${ins.bitmapHeight}.BITMAP`} · {ins.id}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function OfferList({
  offers,
  loading,
  empty,
  renderExtra,
}: {
  offers: DeliveredOffer[];
  loading: boolean;
  empty: string;
  renderExtra?: (offer: DeliveredOffer) => React.ReactNode;
}) {
  if (loading) {
    return (
      <p className="p-5 font-mono text-xs text-muted-foreground">
        &gt; LOADING OFFERS<span className="blink">_</span>
      </p>
    );
  }
  if (offers.length === 0) {
    return (
      <p className="p-5 font-mono text-xs text-muted-foreground">
        &gt; {empty}
        <span className="blink">_</span>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {offers.map((offer) => (
        <li key={offer.id} className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="display text-sm">
              {offer.bitmapHeight === null ? "UNKNOWN PARCEL" : `${offer.bitmapHeight}.BITMAP`}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="display text-sm">{formatSats(offer.priceSats)}</span>
              <span className="label">{OFFER_STATUS_LABEL[offer.status]}</span>
            </div>
          </div>
          <dl className="mt-2 grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
            <div>SELLER {shortenAddress(offer.sellerAddress)}</div>
            <div>
              {offer.buyerAddress
                ? `SENT TO ${shortenAddress(offer.buyerAddress)}`
                : "NOT SENT TO A BUYER YET"}
            </div>
            <div className="break-all">UTXO {offer.outpoint}</div>
            {offer.deliveryNote && <div>NOTE {offer.deliveryNote}</div>}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn-term-ghost !px-3 !py-1.5"
              onClick={() => {
                void navigator.clipboard.writeText(offer.psbtBase64);
                toast("PSBT COPIED", { description: "SIGN AND BROADCAST FROM YOUR WALLET" });
              }}
            >
              COPY PSBT
            </button>
            <button
              className="btn-term-ghost !px-3 !py-1.5"
              onClick={() => {
                const blob = new Blob([offer.psbtBase64], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${offer.bitmapHeight ?? "offer"}.psbt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              DOWNLOAD .PSBT
            </button>
          </div>
          {renderExtra?.(offer)}
        </li>
      ))}
    </ul>
  );
}

/** Sends the signed seller PSBT straight to a buyer's wallet address inbox. */
function DeliverForm({ offer }: { offer: DeliveredOffer }) {
  const queryClient = useQueryClient();
  const [buyer, setBuyer] = useState("");
  const [note, setNote] = useState("");

  const deliver = useMutation({
    mutationFn: () =>
      deliverOfferFn({
        data: { offerId: offer.id, buyerAddress: buyer.trim(), ...(note.trim() ? { note: note.trim() } : {}) },
      }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
      setBuyer("");
      setNote("");
      toast("PSBT SENT TO BUYER", { description: shortenAddress(r.buyerAddress) });
    },
    onError: (e) => toast("DELIVERY FAILED", { description: (e as Error).message }),
  });

  if (offer.status !== "open") return null;

  return (
    <div className="mt-4 border border-border p-4">
      <p className="label">SEND SIGNED PSBT TO A BUYER</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          spellCheck={false}
          placeholder="BUYER ADDRESS bc1…"
          className="flex-1 border border-border bg-background px-3 py-2 font-mono text-[11px] break-all text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="NOTE (OPTIONAL)"
          maxLength={200}
          className="border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none sm:w-56"
        />
        <button
          className="btn-term"
          disabled={deliver.isPending || buyer.trim() === ""}
          onClick={() => deliver.mutate()}
        >
          {deliver.isPending ? "[ SENDING… ]" : "[ SEND PSBT ]"}
        </button>
      </div>
    </div>
  );
}

/**
 * Buyer-side claim. Once the buyer has completed and broadcast the seller's
 * PSBT, this verifies on chain that the inscription UTXO was really spent,
 * records the confirmed transfer as a trade and closes the listing, so the
 * parcel shows the new holder across the marketplace and detail pages.
 */
function ClaimAction({ offer, address }: { offer: DeliveredOffer; address: string }) {
  const queryClient = useQueryClient();

  const claim = useMutation({
    mutationFn: () => settleOfferFn({ data: { offerId: offer.id, claimerAddress: address } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      void queryClient.invalidateQueries({ queryKey: ["registry"] });
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      if (!result.settled) {
        toast("NOT CONFIRMED YET", { description: result.reason.toUpperCase() });
        return;
      }
      toast(`PARCEL CLAIMED — ${result.bitmapHeight ?? "?"}.BITMAP`, {
        description: `${result.ownerAddress ? `HOLDER ${shortenAddress(result.ownerAddress)}` : "HOLDER PENDING"} · ${
          result.salePriceSats ? formatSats(result.salePriceSats) : "NO PAYMENT OUTPUT FOUND"
        }`,
      });
    },
    onError: (e) => toast("CLAIM FAILED", { description: (e as Error).message }),
  });

  if (offer.status !== "open") {
    return (
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        &gt; SETTLED — UTXO SPENT ON CHAIN<span className="blink">_</span>
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button className="btn-term" disabled={claim.isPending} onClick={() => claim.mutate()}>
        {claim.isPending ? "[ VERIFYING CHAIN… ]" : "[ CLAIM PARCEL ]"}
      </button>
      <span className="label">BROADCAST THE PSBT FIRST, THEN CLAIM</span>
    </div>
  );
}
