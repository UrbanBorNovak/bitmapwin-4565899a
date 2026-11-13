import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";
import { slabMasterHtml } from "@/lib/slab-master-delegate";

/** One-time inscription of the Living Slab master renderer (no parent, 330 sat postage). */
export function SlabMasterInscribe() {
  const html = slabMasterHtml();
  const kb = (new TextEncoder().encode(html).length / 1024).toFixed(1);
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!txid || confirmed) return;
    const check = async () => {
      try {
        const r = await fetch(`https://mempool.space/api/tx/${txid}/status`);
        if (r.ok && (await r.json()).confirmed === true) setConfirmed(true);
      } catch { /* retry next tick */ }
    };
    void check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [txid, confirmed]);

  const id = txid ? `${txid}i0` : "";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-mono text-xs text-muted-foreground underline hover:text-primary">
        INSCRIBE THE SLAB MASTER (ONCE) · UNLOCKS SKINS ON ORDINALS.COM
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3 font-mono text-xs">
      <p className="text-primary">SLAB MASTER RENDERER</p>
      {txid ? (
        <div className="space-y-1">
          <p className={confirmed ? "text-accent" : "text-muted-foreground"}>
            {confirmed ? "CONFIRMED ON BITCOIN" : "WAITING FOR CONFIRMATION (CHECKED EVERY 30S)"}
          </p>
          <p className="break-all">INSCRIPTION ID: {id}</p>
          <div className="flex gap-3">
            <a className="underline" href={`https://mempool.space/tx/${txid}`} target="_blank" rel="noreferrer">MEMPOOL</a>
            <a className="underline" href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer">ORDINALS.COM</a>
            <button className="underline" onClick={() => void navigator.clipboard.writeText(id).then(() => toast.success("ID copied"))}>COPY ID</button>
          </div>
          {confirmed && <p className="text-muted-foreground">Send this ID in chat so new grades start pointing at it.</p>}
        </div>
      ) : !agreed ? (
        <div className="space-y-2">
          <ul className="space-y-1">
            <li className="flex justify-between"><span>SIZE</span><span>{kb} KB (on-chain only, Three.js from inscription)</span></li>
            <li className="flex justify-between"><span>POSTAGE</span><span>330 sats (stays in your wallet)</span></li>
            <li className="flex justify-between"><span>SITE FEE</span><span>0 sats</span></li>
            <li className="flex justify-between"><span>MINER FEE</span><span>shown in the next step, set by your fee rate</span></li>
            <li className="flex justify-between"><span>DESTINATION</span><span>your connected ordinals address</span></li>
          </ul>
          <p className="text-muted-foreground">Includes all 5 skins, real transaction parcels, signatures and the upgrade hook. Inscribe it once only.</p>
          <div className="flex gap-3">
            <button onClick={() => setAgreed(true)} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">I UNDERSTAND THE FEES · CONTINUE</button>
            <button onClick={() => void navigator.clipboard.writeText(html).then(() => toast.success("Master HTML copied"))} className="underline">COPY HTML</button>
          </div>
        </div>
      ) : (
        <ShadowInscriber
          slug="slab-master"
          height={0}
          index={0}
          digest="bw-slab-master-1"
          artifactLabel="LIVING SLAB MASTER"
          actionLabel="INSCRIBE MASTER"
          allowUpload={false}
          artifactVariants={[{ key: "master", label: "MASTER", contentType: "text/html;charset=utf-8", source: html, postage: 330 }]}
          onRevealed={(t) => setTxid(t)}
        />
      )}
    </div>
  );
}
