import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";
import { findCommitOutput, listUnrevealedJobs, markRevealed, saveJob, type InscribeJob } from "@/lib/shadow-inscribe";

type Found = { job: InscribeJob; value: number };

/** Height a job claims as its Bitmap parent, read from its stored parent list. */
function parentHeight(job: InscribeJob): number | undefined {
  const raw = (job.parents ?? []).map((p) => (p as { height?: number }).height).find((h) => typeof h === "number");
  return raw;
}

/**
 * Finds every paid commit whose one-time key is still on this device and lets
 * the holder finish Step 2 with one click — no new fee, no recovery file.
 */
export function UnfinishedInscriptions() {
  const [found, setFound] = useState<Found[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    void (async () => {
      const out: Found[] = [];
      for (const job of listUnrevealedJobs()) {
        const utxo = await findCommitOutput(job).catch(() => null);
        if (utxo) out.push({ job: { ...job, commitTxid: job.commitTxid ?? utxo.txid }, value: utxo.value });
      }
      if (!stop) setFound(out);
    })();
    return () => {
      stop = true;
    };
  }, []);

  if (!found?.length) return null;

  return (
    <div className="space-y-2 border border-bitcoin bg-bitcoin/5 p-3">
      <p className="label text-bitcoin">◆ {found.length} UNFINISHED INSCRIPTION{found.length > 1 ? "S" : ""} FOUND ON THIS DEVICE</p>
      <p className="font-mono text-[11px] text-muted-foreground">
        THE FEE IS ALREADY PAID ON BITCOIN. FINISH STEP 2 BELOW — NO NEW PAYMENT.{" "}
        <Link to="/payments" className="text-signal underline">SEE ALL PAYMENTS →</Link>
      </p>
      {found.map(({ job, value }) => (
        <div key={job.commitAddress} className="space-y-2 border border-border p-2">
          <p className="font-mono text-[10px] text-muted-foreground break-all">
            {value.toLocaleString("en-US")} SATS WAITING · {job.commitAddress}
          </p>
          {open === job.commitAddress ? (
            <ShadowInscriber
              slug="recovery"
              height={parentHeight(job) ?? 0}
              index={0}
              digest={job.digest}
              artifactLabel="FINISH THIS INSCRIPTION"
              allowUpload={false}
              autoReveal
              onRevealed={(txid) => {
                markRevealed(job, txid);
                toast.success("STEP 2 SENT — YOUR GUARDIAN IS BEING INSCRIBED");
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                saveJob(job);
                setOpen(job.commitAddress);
              }}
              className="w-full border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background"
            >
              ◆ FINISH STEP 2 · SIGN IN WALLET (NO NEW FEE)
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
