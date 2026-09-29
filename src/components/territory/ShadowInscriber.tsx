import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resolveWallet } from "@/components/BuyButton";
import { sendBitcoinFromWallet, signParentInputsPsbt } from "@/lib/browser-wallet";
import { mintParentsFn, signCollectionParentFn } from "@/lib/ord-parents.functions";
import type { ParentSpend } from "@/lib/ord-parents";
import {
  INSCRIBE_MAX_BYTES,
  clearJob,
  findCommitOutput,
  loadJob,
  passArtifactSvg,
  prepareJob,
  revealJob,
  saveJob,
  type InscribeJob,
  type ParentSigners,
} from "@/lib/shadow-inscribe";

/**
 * Inscribes a visual artifact as a real Ordinals inscription beside a SHAD note.
 * Default art is drawn from the pass's public note fields; the holder may swap
 * in their own file. Keys for the reveal are made and kept on this device.
 *
 * With `claimParentsForHeight`, the reveal also claims two parents: that
 * `<height>.bitmap` and the BITMAPWIN master collection inscription. Both are
 * spent as inputs and returned to their holders in the same transaction.
 */
export function ShadowInscriber(props: {
  slug: string;
  height: number;
  index: number;
  digest: string;
  artifactSvg?: string;
  artifactLabel?: string;
  actionLabel?: string;
  description?: string;
  allowUpload?: boolean;
  /** Claim `<height>.bitmap` + the master collection as parents of this child. */
  claimParentsForHeight?: number;
  /** Where the inscribed sat lands. Defaults to the connected wallet's ordinals address. */
  receiveAddress?: string;
  /** Runs after the one-time payment address exists, before the wallet pays. Throw to abort. */
  onPrepared?: (job: InscribeJob) => Promise<void> | void;
  /** Runs once the inscription reveal is broadcast. */
  onRevealed?: (revealTxid: string, job: InscribeJob) => Promise<void> | void;
}) {
  const [job, setJob] = useState<InscribeJob | null>(null);
  const [file, setFile] = useState<{ type: string; bytes: Uint8Array; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [parentNotes, setParentNotes] = useState<string[]>([]);
  const resolveParents = useServerFn(mintParentsFn);
  const signCollection = useServerFn(signCollectionParentFn);

  useEffect(() => setJob(loadJob(props.digest)), [props.digest]);

  const svg = useMemo(() => props.artifactSvg ?? passArtifactSvg(props), [props.artifactSvg, props.digest, props.height, props.index, props.slug]);
  const defaultUrl = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, [svg]);


  // Watch for the commit payment, then reveal automatically.
  useEffect(() => {
    if (!job?.commitTxid || job.revealTxid) return;
    let stop = false;
    const tick = async () => {
      const utxo = await findCommitOutput(job);
      if (!utxo || stop) return;
      try {
        setBusy("REVEALING…");
        const signers: ParentSigners = {};
        if (job.parents?.length) {
          if (job.parents.some((p) => p.signer === "wallet")) {
            setBusy("APPROVE THE PARENT CLAIM IN YOUR WALLET…");
            const wallet = await resolveWallet();
            signers.wallet = (psbt, indices) => signParentInputsPsbt(wallet.provider, psbt, wallet.ordinalsAddress, indices);
          }
          if (job.parents.some((p) => p.signer === "platform")) {
            signers.platform = async (psbt) => {
              const res = await signCollection({ data: { psbt } });
              if (!res.ok) throw new Error(res.reason);
              return res.psbt;
            };
          }
        }
        const revealTxid = await revealJob(job, utxo, signers);
        const done = { ...job, revealTxid };
        saveJob(done);
        setJob(done);
        await props.onRevealed?.(revealTxid, done);
        toast.success("ARTIFACT INSCRIBED — WAITING FOR A MINER");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(null);
      }
    };
    void tick();
    const t = setInterval(tick, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [job]);


  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > INSCRIBE_MAX_BYTES) {
      toast.error("FILE TOO LARGE — KEEP IT UNDER 60 KB");
      return;
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    setFile({ type: f.type || "application/octet-stream", bytes, url: URL.createObjectURL(f) });
  };

  const start = async () => {
    try {
      setBusy("PRICING…");
      const wallet = await resolveWallet();
      const body = file?.bytes ?? new TextEncoder().encode(svg);
      let parents: ParentSpend[] = [];
      if (props.claimParentsForHeight !== undefined) {
        setBusy("CHECKING THE PARENT BITMAP…");
        try {
          const res = await resolveParents({ data: { height: props.claimParentsForHeight, holderAddress: wallet.ordinalsAddress } });
          parents = res.parents;
          setParentNotes(res.notes);
        } catch {
          setParentNotes(["COULD NOT CHECK THE PARENTS — INSCRIBING WITHOUT THEM"]);
        }
      }
      const prepared = await prepareJob({
        digest: props.digest,
        contentType: file?.type ?? "image/svg+xml",
        body,
        receiveAddress: props.receiveAddress ?? wallet.ordinalsAddress,
        ...(parents.length ? { parents } : {}),
      });

      setJob(prepared);
      if (props.onPrepared) {
        setBusy("RESERVING THE SHIELDED NOTE…");
        await props.onPrepared(prepared);
      }
      setBusy("APPROVE IN YOUR WALLET…");
      const commitTxid = await sendBitcoinFromWallet(wallet.provider, prepared.commitAddress, prepared.commitAmount);
      const paid = { ...prepared, commitTxid };
      saveJob(paid);
      setJob(paid);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const downloadRecovery = () => {
    if (!job) return;
    const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${props.artifactLabel ?? "shadow-pass"}-inscribe-recovery-${job.digest.slice(0, 8)}.json`;
    a.click();
  };

  const preview = file?.url ?? defaultUrl;

  return (
    <div className="border border-bitcoin/40 bg-bitcoin/5 p-3 space-y-2">
      <p className="label text-bitcoin">◆ {props.artifactLabel ?? "INSCRIBE AN ARTIFACT BESIDE THIS NOTE"}</p>
      {file?.type.startsWith("image/") || !file ? (
        <img src={preview} alt="Artifact preview" className="w-full max-w-[220px] border border-border/40" />
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">{file.type} · {file.bytes.length} BYTES</p>
      )}

      {!job?.commitTxid ? (
        <>
          {props.allowUpload !== false ? <label className="label block cursor-pointer text-muted-foreground hover:text-foreground">
            {file ? "◇ SWAP FILE" : "◇ USE MY OWN FILE INSTEAD (UNDER 60 KB)"}
            <input type="file" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label> : null}
          {file ? (
            <button type="button" className="label text-muted-foreground underline" onClick={() => setFile(null)}>
              ← BACK TO THE PASS ART
            </button>
          ) : null}
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void start()}
            className="w-full border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background disabled:opacity-40"
          >
            {busy ?? props.actionLabel ?? "◆ INSCRIBE ON BITCOIN"}
          </button>
          <p className="label text-muted-foreground">
            {props.description ?? "TWO STEPS: YOUR WALLET PAYS ONCE, THEN THIS DEVICE FINISHES THE INSCRIPTION. KEEP THE TAB OPEN."}
          </p>
          {props.claimParentsForHeight !== undefined ? (
            <p className="label text-signal">
              ⧉ THIS CREATURE IS INSCRIBED AS A CHILD OF {props.claimParentsForHeight}.BITMAP AND OF THE BITMAPWIN COLLECTION. BOTH PARENTS PASS
              THROUGH THE SAME TRANSACTION AND GO STRAIGHT BACK TO THEIR HOLDERS.
            </p>
          ) : null}
          {parentNotes.map((n) => (
            <p key={n} className="label text-bitcoin">
              ⚠ {n}
            </p>
          ))}

        </>
      ) : (
        <div className="space-y-1 font-mono text-[11px]">
          <p>PAID {job.commitAmount.toLocaleString()} SATS · {job.feeRate} SAT/VB · 546 STAY ON YOUR ARTIFACT</p>
          <a className="text-signal underline" target="_blank" rel="noreferrer" href={`https://mempool.space/tx/${job.commitTxid}`}>
            STEP 1 · PAYMENT ↗
          </a>
          {job.revealTxid ? (
            <>
              <a className="block text-signal underline" target="_blank" rel="noreferrer" href={`https://mempool.space/tx/${job.revealTxid}`}>
                STEP 2 · INSCRIPTION ↗
              </a>
              <a className="block text-bitcoin underline" target="_blank" rel="noreferrer" href={`https://ordinals.com/inscription/${job.revealTxid}i0`}>
                VIEW {job.revealTxid.slice(0, 8)}…i0 ON ORDINALS ↗
              </a>
              <button type="button" className="label text-muted-foreground underline" onClick={() => { clearJob(job.digest); setJob(null); }}>
                INSCRIBE ANOTHER
              </button>
            </>
          ) : (
            <p className="text-signal">{busy ?? "WAITING FOR YOUR PAYMENT TO APPEAR · FINISHES BY ITSELF"}</p>
          )}
          {!job.revealTxid ? (
            <button type="button" className="label text-bitcoin underline" onClick={downloadRecovery}>
              ⤓ SAVE RECOVERY FILE (NEEDED IF THIS DEVICE IS LOST)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
