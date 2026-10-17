import { useState } from "react";
import { buildListingPsbt } from "@/lib/psbt-builder";
import { connectWallet, signListingPsbt, xOnlyPubKeyHex, type ConnectedWallet, type WalletProviderId } from "@/lib/browser-wallet";
import { deviceNostrKey, listingTags, NOSTR_RELAYS, publishEvent, signEvent } from "@/lib/nostr-listing";
import { OCI_LAST, OCI_MODULE_ID } from "@/lib/sovereign-store";

const ORD = "https://ordinals.com";

/** Seller side of the sovereign shop: sign a listing in your own wallet and post it to Nostr. */
export function NostrListPanel() {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [height, setHeight] = useState("");
  const [btc, setBtc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const input = "w-full rounded border border-border bg-background/60 px-3 py-2 text-sm";

  const connect = async (p: WalletProviderId) => {
    try {
      setWallet(await connectWallet(p));
      setMsg("");
    } catch (e) {
      setMsg(`WALLET NOT CONNECTED — ${(e as Error).message}`);
    }
  };

  const list = async () => {
    if (!wallet) return;
    const h = Number(height);
    const priceSats = Math.round(Number(btc) * 1e8);
    if (!Number.isInteger(h) || h < 0 || h > OCI_LAST) return setMsg(`ENTER A BLOCK FROM 0 TO ${OCI_LAST.toLocaleString("en-US")}`);
    if (!(priceSats >= 546)) return setMsg("ENTER A PRICE OF AT LEAST 0.00000546 BTC");
    setBusy(true);
    try {
      setMsg("FINDING THE REAL BITMAP ON CHAIN…");
      const mod = (await import(/* @vite-ignore */ `${ORD}/content/${OCI_MODULE_ID}?origin=${ORD}`)) as {
        getBitmapInscriptionId: (n: number) => Promise<string | null>;
      };
      const id = await mod.getBitmapInscriptionId(h);
      if (!id) throw new Error(`${h}.bitmap IS NOT IN THE ON-CHAIN INDEX`);
      const ins = (await fetch(`${ORD}/r/inscription/${id}`).then((r) => r.json())) as { output: string; value: number; address?: string };
      if (ins.address !== wallet.ordinalsAddress) throw new Error(`${h}.bitmap IS NOT IN THIS WALLET`);
      const [txid, vout] = ins.output.split(":");
      const psbt = buildListingPsbt({
        txid: txid!,
        vout: Number(vout),
        utxoValueSats: ins.value,
        sellerAddress: wallet.ordinalsAddress,
        priceSats,
        ...(xOnlyPubKeyHex(wallet.publicKey) ? { tapInternalKeyHex: xOnlyPubKeyHex(wallet.publicKey)! } : {}),
        ...(wallet.publicKey ? { publicKeyHex: wallet.publicKey } : {}),
      });
      setMsg("SIGN THE OFFER IN YOUR WALLET…");
      const signed = await signListingPsbt(wallet.provider, psbt, wallet.ordinalsAddress);
      const ev = signEvent(
        listingTags({ height: h, inscriptionId: id, outpoint: ins.output, priceSats, psbtBase64: signed, seller: wallet.ordinalsAddress }),
        `${h}.bitmap for ${priceSats} sats`,
        deviceNostrKey(),
      );
      const ok = await publishEvent(ev);
      setMsg(ok.length ? `LISTED ON ${ok.length} OF ${NOSTR_RELAYS.length} RELAYS — EVERY SOVEREIGN SHOP CAN NOW SHOW IT` : "NO RELAY ACCEPTED IT — TRY AGAIN");
    } catch (e) {
      setMsg(`NOT LISTED — ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded border border-signal/50 p-4">
      <div className="label text-signal">LIST A BITMAP ON NOSTR</div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        You sign the offer in your own wallet; it is posted to open relays so any sovereign shop can sell it. Lowering the
        price later is fine — to raise it or cancel, move the BITMAP to a new address (old offers stop working).
      </p>
      {!wallet ? (
        <div className="flex gap-2">
          <button onClick={() => connect("unisat")} className="flex-1 rounded border border-border px-3 py-2 text-xs font-bold">UNISAT</button>
          <button onClick={() => connect("xverse")} className="flex-1 rounded border border-border px-3 py-2 text-xs font-bold">XVERSE</button>
        </div>
      ) : (
        <>
          <p className="break-all font-mono text-[11px] text-signal">{wallet.ordinalsAddress}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">BLOCK<input className={input} inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} /></label>
            <label className="block text-xs">PRICE (BTC)<input className={input} inputMode="decimal" value={btc} onChange={(e) => setBtc(e.target.value.replace(/[^\d.]/g, ""))} /></label>
          </div>
          <button onClick={list} disabled={busy} className="w-full rounded bg-signal px-4 py-2 text-xs font-bold text-background disabled:opacity-50">
            {busy ? "WORKING…" : "SIGN & LIST ON NOSTR"}
          </button>
        </>
      )}
      {msg && <p className="font-mono text-[11px] text-signal">{msg}</p>}
    </div>
  );
}
