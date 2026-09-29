import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";
import { createKeys, loadKeys, type ShordKeys } from "@/lib/shord/keys";
import { assetIdFromInscription, poolNote, randomField } from "@/lib/shord/pool";
import { loadPoolNotes, savePoolNotes } from "@/lib/shord/deposit";
import { shordClaimMint, shordPoolInfo, shordReserveMint } from "@/lib/shord-pool.functions";

/**
 * Direct-to-shield Guardian mint.
 *
 * The inscription reveal sends the inscribed sat straight to the shielded pool
 * address, so the artifact never rests at a public wallet address. Ownership is
 * a BabyJubjub note commitment held only on this device.
 */

const SECRET_KEY = (commitAddress: string) => `bitmapwin:shord-mint:${commitAddress}`;

function newClaimSecret(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function ShieldedGuardianMint({
  height,
  digest,
  artifactSvg,
}: {
  height: number;
  digest: string;
  artifactSvg: string;
}) {
  const poolInfo = useServerFn(shordPoolInfo);
  const reserve = useServerFn(shordReserveMint);
  const claim = useServerFn(shordClaimMint);
  const pool = useQuery({ queryKey: ["shord", "own-pool", "address"], queryFn: () => poolInfo() });
  const [keys, setKeys] = useState<ShordKeys | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => setKeys(loadKeys()), []);

  if (!keys) {
    return (
      <div className="space-y-2 border border-signal/40 bg-signal/5 p-3">
        <p className="label text-signal">◈ MINT STRAIGHT INTO THE SHIELDED POOL</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          THE GUARDIAN IS INSCRIBED DIRECTLY TO THE POOL, SO NO BITCOIN ADDRESS OF YOURS EVER HOLDS IT. OWNERSHIP BECOMES A
          SEALED NOTE ONLY THIS DEVICE'S SHIELDED KEY CAN MOVE.
        </p>
        <button
          type="button"
          onClick={() => {
            setKeys(createKeys());
            toast.success("SHIELDED KEY MADE ON THIS DEVICE — BACK IT UP ON THE SHIELDED VAULT PAGE");
          }}
          className="w-full border border-signal px-3 py-2 font-mono text-xs text-signal hover:bg-signal hover:text-background"
        >
          ◈ MAKE MY SHIELDED KEY
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-2 border border-signal/40 bg-signal/5 p-3 font-mono text-[11px]">
        <p className="label text-signal">◈ SHIELDED MINT SENT</p>
        <p className="break-all text-muted-foreground">{done}</p>
        <Link to="/shord" className="block text-signal underline">
          OPEN THE SHIELDED VAULT AND PRESS CHECK DEPOSIT →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2 border border-signal/40 bg-signal/5 p-3">
      <p className="label text-signal">◈ MINT STRAIGHT INTO THE SHIELDED POOL</p>
      <p className="font-mono text-[10px] text-muted-foreground">
        SHIELDED TO {keys.address.slice(0, 16)}… · BACK THAT KEY UP OR THE GUARDIAN CANNOT LEAVE THE POOL.
      </p>
      <ShadowInscriber
        slug={`guardian-shielded-${height}`}
        height={height}
        index={0}
        digest={`${digest}-shielded`}
        artifactSvg={artifactSvg}
        artifactLabel="SHIELDED GUARDIAN · DIRECT TO POOL"
        actionLabel="◈ INSCRIBE INTO THE SHIELDED POOL"
        description="YOUR WALLET PAYS THE MINER COST ONCE. THE GUARDIAN IS INSCRIBED TO THE POOL ADDRESS, NOT TO YOUR WALLET, AND ONLY THIS DEVICE'S SHIELDED KEY CAN MOVE IT AFTERWARDS."
        allowUpload={false}
        claimParentsForHeight={height}

        {...(pool.data?.poolAddress ? { receiveAddress: pool.data.poolAddress } : {})}
        onPrepared={async (job) => {
          if (!pool.data?.poolAddress) throw new Error("THE POOL ADDRESS IS NOT READY YET — TRY AGAIN");
          const claimSecret = newClaimSecret();
          localStorage.setItem(SECRET_KEY(job.commitAddress), claimSecret);
          const res = await reserve({ data: { commitAddress: job.commitAddress, claimSecret, blockHeight: height } });
          if (!res.ok) throw new Error(res.reason);
        }}
        onRevealed={async (revealTxid, job) => {
          const claimSecret = localStorage.getItem(SECRET_KEY(job.commitAddress));
          if (!claimSecret) {
            toast.error("THIS DEVICE LOST THE MINT RESERVATION CODE — CONTACT SUPPORT WITH THE RECOVERY FILE");
            return;
          }
          const inscriptionId = `${revealTxid}i0`;
          const assetId = assetIdFromInscription(inscriptionId);
          const salt = randomField();
          const commitment = poolNote(keys.publicKey, assetId, salt).toString();
          const res = await claim({ data: { commitAddress: job.commitAddress, claimSecret, commitment, revealTxid } });
          if (!res.ok) {
            toast.error(res.reason);
            return;
          }
          savePoolNotes([
            ...loadPoolNotes().filter((n) => n.inscriptionId !== inscriptionId),
            { inscriptionId, assetId: assetId.toString(), salt: salt.toString(), commitment, status: "awaiting" },
          ]);
          setDone(`SEALED NOTE REGISTERED FOR ${inscriptionId}`);
          toast.success("GUARDIAN INSCRIBED INTO THE SHIELDED POOL");
        }}
      />
    </div>
  );
}
