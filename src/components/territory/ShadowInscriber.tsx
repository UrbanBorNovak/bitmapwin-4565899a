import { checkMintParents } from "@/lib/mint-parents-guard";
import { offlinePreview } from "@/lib/offline-preview";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resolveWallet } from "@/components/BuyButton";
import { refreshWalletKeys, sendBitcoinFromWallet, signParentInputsPsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { mintParentsFn, signCollectionParentFn, heldParentSpendFn } from "@/lib/ord-parents.functions";
import type { ParentSpend } from "@/lib/ord-parents";
import {
  INSCRIBE_MAX_BYTES,
  clearJob,
  findCommitOutput,
  liveFeeRate,
  loadJob,
  passArtifactSvg,
  prepareJob,
  revealJob,
  saveJob,
  type InscribeJob,
  type ParentSigners,
  listUnrevealedJobs,
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
export type ArtifactVariant = {
  /** Stable key used for the picker. */
  key: string;
  /** Short label shown on the picker button. */
  label: string;
  /** Inscription content type, e.g. `text/html;charset=utf-8`. */
  contentType: string;
  /** The artifact source itself, inscribed as UTF-8 text. */
  source: string;
  /** One line explaining what this form does in a viewer. */
  note?: string;
  /** Tag 11 target: inscribe an empty body that renders with this inscription's code. */
  delegate?: string;
  /** Output paid inside the reveal, so the master generator can verify it on chain. */
  tribute?: { address: string; sats: number };
  /** Creator payouts (Land Forge contributors), one output each inside the reveal. */
  tributes?: { address: string; sats: number }[];
  /** Tag 5 metadata (with a delegate: the build's own bytes). */
  metadata?: Record<string, unknown>;
  /** Brotli-pack the source and inscribe it with tag 9 `content-encoding: br`. */
  brotli?: boolean;
};

export function ShadowInscriber(props: {
  slug: string;
  height: number;
  index: number;
  digest: string;
  artifactSvg?: string;
  /** Two or more forms of the same artifact; the holder picks one before paying. */
  artifactVariants?: ArtifactVariant[];
  artifactLabel?: string;
  actionLabel?: string;
  description?: string;
  allowUpload?: boolean;
  /** Claim `<height>.bitmap` + the master collection as parents of this child. */
  claimParentsForHeight?: number;
  /** Optional user-supplied `<height>.bitmap` inscription id (verified server-side). */
  parentBitmapInscriptionId?: string;
  /** Reinscribe: land the new inscription on the BITMAP's own sat (tag 2 pointer). */
  reinscribeOnBitmap?: boolean;
  /** With reinscribeOnBitmap: stamp onto this held parcel's sat instead of the BITMAP's. */
  parcelIndex?: number;
  /** Claim this held inscription (e.g. your Guardian) as the Tag 3 parent; wallet signs, it returns sat-for-sat. */
  heldParentId?: string;
  /** Server refuses to price the inscription unless this block's Guardian is already summoned. */
  requireAwake?: boolean;
  /** Where the inscribed sat lands. Defaults to the connected wallet's ordinals address. */
  receiveAddress?: string;
  /** Runs after the one-time payment address exists, before the wallet pays. Throw to abort. */
  onPrepared?: (job: InscribeJob) => Promise<void> | void;
  /** Runs once the inscription reveal is broadcast. */
  onRevealed?: (revealTxid: string, job: InscribeJob) => Promise<void> | void;
  /** Start signing and broadcasting Step 2 as soon as the paid commit is seen. */
  autoReveal?: boolean;
  /** Price and open the payment by itself once on mount, when no job exists yet. */
  autoStart?: boolean;
}) {
  const [job, setJob] = useState<InscribeJob | null>(null);
  const [file, setFile] = useState<{ type: string; bytes: Uint8Array; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [parentNotes, setParentNotes] = useState<string[]>([]);
  const [variantKey, setVariantKey] = useState<string | null>(null);
  const resolveParents = useServerFn(mintParentsFn);
  const resolveHeldParent = useServerFn(heldParentSpendFn);
  const signCollection = useServerFn(signCollectionParentFn);

  useEffect(() => setJob(loadJob(props.digest)), [props.digest]);

  const [feeMode, setFeeMode] = useState<string>("live");
  const [customFee, setCustomFee] = useState("1");
  const [liveRate, setLiveRate] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bitmapwin:inscribe-fee");
      if (saved) { const s = JSON.parse(saved) as { mode: string; custom: string }; setFeeMode(s.mode); setCustomFee(s.custom); }
    } catch { /* ignore */ }
    void liveFeeRate().then(setLiveRate).catch(() => {});
  }, []);
  useEffect(() => {
    try { localStorage.setItem("bitmapwin:inscribe-fee", JSON.stringify({ mode: feeMode, custom: customFee })); } catch { /* ignore */ }
  }, [feeMode, customFee]);
  const chosenFee = feeMode === "1" ? 1 : feeMode === "custom" && Number(customFee) >= 1 ? Number(customFee) : undefined;

  const variants = props.artifactVariants ?? [];
  const variant = variants.find((v) => v.key === variantKey) ?? variants[0] ?? null;

  const svg = useMemo(() => props.artifactSvg ?? passArtifactSvg(props), [props.artifactSvg, props.digest, props.height, props.index, props.slug]);
  const artifactSource = variant?.source ?? svg;
  const artifactType = variant?.contentType ?? "image/svg+xml";
  const defaultUrl = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, [svg]);



  // Watch for the commit payment. Polling never opens the wallet: a wallet
  // parent claim waits for the user's explicit click, and a lock ensures only
  // one reveal attempt runs at a time.
  const [commitUtxo, setCommitUtxo] = useState<Awaited<ReturnType<typeof findCommitOutput>>>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const revealing = useRef(false);
  const autoTried = useRef<string | null>(null);
  const needsWallet = !!job?.parents?.some((p) => p.signer === "wallet");

  const reveal = async (current: InscribeJob, utxo: NonNullable<typeof commitUtxo>) => {
    if (revealing.current || current.revealTxid) return;
    revealing.current = true;
    setRevealError(null);
    try {
      setBusy("REVEALING…");
      const signers: ParentSigners = {};
      let toReveal = current;
      if (current.parents?.length) {
        if (current.parents.some((p) => p.signer === "wallet")) {
          setBusy("APPROVE THE PARENT CLAIM IN YOUR WALLET…");
          let wallet = await resolveWallet();
          // Taproot key-path spends need the holder's internal key on the PSBT
          // input, otherwise Xverse fails with "No taproot scripts signed".
          if (!xOnlyPubKeyHex(wallet.publicKey)) wallet = await refreshWalletKeys(wallet);
          const internal = xOnlyPubKeyHex(wallet.publicKey);
          if (!internal && current.parents.some((p) => p.signer === "wallet" && /^bc1p/i.test(p.address))) {
            throw new Error("YOUR WALLET DID NOT SHARE ITS ORDINALS KEY — RECONNECT THE WALLET AND RETRY STEP 2");
          }
          toReveal = {
            ...current,
            parents: current.parents.map((p) =>
              p.signer === "wallet" && internal && /^bc1p/i.test(p.address)
                ? { ...p, tapInternalKey: internal }
                : p,
            ),
          };
          saveJob(toReveal);
          const holder = toReveal.parents?.find((p) => p.signer === "wallet")?.address ?? wallet.ordinalsAddress;
          signers.wallet = (psbt, indices) => signParentInputsPsbt(wallet.provider, psbt, holder, indices);
        }
        if (current.parents.some((p) => p.signer === "platform")) {
          signers.platform = async (psbt) => {
            const res = await signCollection({ data: { psbt } });
            if (!res.ok) throw new Error(res.reason);
            return res.psbt;
          };
        }
      }
      const revealTxid = await revealJob(toReveal, utxo, signers);
      const done = { ...current, revealTxid };
      saveJob(done);
      setJob(done);
      await props.onRevealed?.(revealTxid, done);
      toast.success("ARTIFACT INSCRIBED — WAITING FOR A MINER");
    } catch (e) {
      const msg = (e as Error).message;
      setRevealError(msg);
      toast.error(msg);
    } finally {
      revealing.current = false;
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!job?.commitTxid || job.revealTxid) return;
    let stop = false;
    const poll = async () => {
      if (commitUtxo) return;
      const utxo = await findCommitOutput(job);
      if (!utxo || stop) return;
      setCommitUtxo(utxo);
      // No wallet prompt needed → finish once by itself.
      if ((!needsWallet || props.autoReveal) && autoTried.current !== job.digest) {
        autoTried.current = job.digest;
        void reveal(job, utxo);
      }
    };
    void poll();
    const t = setInterval(poll, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, commitUtxo]);


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
    setParentNotes([]);
    try {
      setBusy("CHECKING FOR AN EARLIER PAYMENT…");
      // Never ask for a second fee while an earlier paid commit sits unspent.
      for (const old of listUnrevealedJobs().filter((j) => j.digest === props.digest)) {
        const utxo = await findCommitOutput(old);
        if (utxo) {
          const resumed = { ...old, commitTxid: old.commitTxid ?? utxo.txid };
          saveJob(resumed);
          setCommitUtxo(null);
          setJob(resumed);
          toast.success("YOU ALREADY PAID — CONTINUE WITH STEP 2, NO NEW FEE");
          return;
        }
      }
      setBusy("PRICING…");
      const wallet = await resolveWallet();
      let body = file?.bytes ?? new TextEncoder().encode(artifactSource);
      let contentEncoding: string | undefined;
      if (!file && variant?.brotli && !variant.delegate) {
        setBusy("COMPRESSING (BROTLI)…");
        const { brotliPackFn } = await import("@/lib/brotli-pack.functions");
        const packed = await brotliPackFn({ data: { text: artifactSource } });
        if (packed.packedBytes < body.length) {
          body = Uint8Array.from(atob(packed.base64), (c) => c.charCodeAt(0));
          contentEncoding = "br";
        }
      }
      let parents: ParentSpend[] = [];
      let pointer: number | undefined;
      if (props.heldParentId && props.claimParentsForHeight === undefined) {
        setBusy("CHECKING YOUR GUARDIAN…");
        const res = await resolveHeldParent({ data: { inscriptionId: props.heldParentId, holderAddress: wallet.ordinalsAddress } });
        if (!res.spend) throw new Error(`MINT STOPPED — ${res.note}. NOTHING WAS PAID.`);
        parents = [res.spend];
      }
      if (props.claimParentsForHeight !== undefined) {
        setBusy("CHECKING THE PARENT BITMAP…");
        let res: Awaited<ReturnType<typeof resolveParents>>;
        try {
          res = await resolveParents({
            data: {
              height: props.claimParentsForHeight,
              holderAddress: wallet.ordinalsAddress,
              ...(props.parentBitmapInscriptionId ? { bitmapInscriptionId: props.parentBitmapInscriptionId } : {}),
              ...(props.requireAwake ? { requireAwake: true } : {}),
              ...(props.parcelIndex !== undefined ? { parcelIndex: props.parcelIndex } : {}),
            },
          });
        } catch {
          setParentNotes(["COULD NOT CHECK THE PARENTS — NOTHING WAS PAID"]);
          throw new Error("COULD NOT CHECK THE PARENT BITMAP — NOTHING WAS PAID, TRY AGAIN");
        }
        setParentNotes(res.notes);
        if (res.notAwake) {
          throw new Error(
            `MINT STOPPED — SUMMON THE ${props.claimParentsForHeight}.BITMAP GUARDIAN FIRST. NOTHING WAS PAID.`,
          );
        }
        // Fail closed before any payment or signature: both parents must be resolved and included.
        const guard = checkMintParents(res);
        if (!guard.ok) {
          setParentNotes([...guard.missing.map((m) => (m === "BITMAP" ? `MISSING: ${props.parcelIndex !== undefined ? `PARCEL #${props.parcelIndex} OF ` : ""}${props.claimParentsForHeight}.BITMAP PARENT` : "MISSING: VERIFIED COLLECTION PARENT")), ...res.notes]);
          throw new Error(guard.message);
        }
        parents = res.parents;
        if (props.reinscribeOnBitmap) {
          let before = 0;
          for (const p of parents) {
            if (p.inscriptionId === res.bitmapParentId) { pointer = before + (p.offset ?? 0); break; }
            before += p.value;
          }
          if (pointer === undefined) throw new Error("MINT STOPPED — COULD NOT LOCATE THE BITMAP'S SAT. NOTHING WAS PAID.");
        }
      }
      const prepared = await prepareJob({
        digest: props.digest,
        contentType: file?.type ?? artifactType,
        body,
        receiveAddress: props.receiveAddress ?? wallet.ordinalsAddress,
        ...(parents.length ? { parents } : {}),
        ...(pointer !== undefined ? { pointer } : {}),
        ...(!file && variant?.delegate ? { delegate: variant.delegate } : {}),
        ...(!file && variant?.metadata ? { metadata: variant.metadata } : {}),
        ...(!file && variant?.tribute ? { tribute: variant.tribute } : {}),
        ...(!file && variant?.tributes?.length ? { tributes: variant.tributes } : {}),
        ...(chosenFee !== undefined ? { feeRate: chosenFee } : {}),
        ...(contentEncoding ? { contentEncoding } : {}),
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

  // Queue the inscription by itself once (e.g. right after a summon confirms):
  // Step 1 opens the wallet to pay the commit (fee + 1,000-sat tribute), then the
  // poller above signs and broadcasts the reveal as soon as that payment is seen.
  // Reads storage directly so a paid or revealed job is never charged twice.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!props.autoStart || autoStarted.current || busy) return;
    const stored = loadJob(props.digest);
    if (stored?.commitTxid || stored?.revealTxid || job?.commitTxid) {
      autoStarted.current = true;
      return;
    }
    autoStarted.current = true;
    toast.info("GUARDIAN AWAKE — STEP 1 · APPROVE THE INSCRIPTION PAYMENT IN YOUR WALLET");
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoStart, job, props.digest]);

  // Resume a paid commit from its recovery file (e.g. after site data was cleared),
  // so the holder finishes Step 2 instead of paying a new fee.
  const importRecovery = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as InscribeJob;
      if (!/^[0-9a-f]{64}$/i.test(parsed.privHex ?? "") || !parsed.commitAddress || !parsed.bodyHex || !parsed.digest) {
        throw new Error("THAT IS NOT A VALID RECOVERY FILE");
      }
      // The digest is baked into the one-time script; it must stay the original.
      const resumed = { ...parsed };
      const utxo = await findCommitOutput(resumed);
      if (!utxo && !resumed.revealTxid) throw new Error("NO UNSPENT PAYMENT FOUND AT THAT RECOVERY ADDRESS");
      if (!resumed.commitTxid && utxo) resumed.commitTxid = utxo.txid;
      saveJob(resumed);
      setCommitUtxo(null);
      setJob(resumed);
      toast.success("PAYMENT RECOVERED — CONTINUE WITH STEP 2, NO NEW FEE");
    } catch (e) {
      toast.error((e as Error).message);
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
  const liveArtifact = !file && variant?.contentType.startsWith("text/html");
  const artifactBytes = file?.bytes.length ?? new TextEncoder().encode(artifactSource).length;

  return (
    <div className="border border-bitcoin/40 bg-bitcoin/5 p-3 space-y-2">
      <p className="label text-bitcoin">◆ {props.artifactLabel ?? "INSCRIBE AN ARTIFACT BESIDE THIS NOTE"}</p>
      {liveArtifact ? (
        <iframe
          title="Live artifact preview"
          srcDoc={offlinePreview(artifactSource)}
          sandbox="allow-scripts"
          className="aspect-square w-full max-w-[280px] border border-border/40 bg-background"
        />
      ) : file?.type.startsWith("image/") || !file ? (
        <img src={preview} alt="Artifact preview" className="w-full max-w-[220px] border border-border/40" />
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">{file.type} · {file.bytes.length} BYTES</p>
      )}
      {variants.length > 1 && !file && !job?.commitTxid ? (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {variants.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setVariantKey(v.key)}
                className={`border px-2 py-1 font-mono text-[10px] ${v.key === variant?.key ? "border-bitcoin bg-bitcoin text-background" : "border-border text-muted-foreground hover:border-bitcoin"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className="label text-muted-foreground">
            {variant?.note ?? ""} · {artifactBytes.toLocaleString()} BYTES ON CHAIN
          </p>
        </div>
      ) : null}


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
          <div className="space-y-1">
            <p className="label text-muted-foreground">FEE RATE · SAT/VB {liveRate ? `· MEMPOOL NOW ${liveRate}` : ""}</p>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { k: "1", label: "1 · ECONOMY" },
                { k: "live", label: "LIVE" },
              ].map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => { setFeeMode(o.k); if (o.k === "1") setCustomFee("1"); }}
                  className={`border px-2 py-1 font-mono text-[10px] ${feeMode === o.k ? "border-bitcoin bg-bitcoin text-background" : "border-border text-muted-foreground hover:border-bitcoin"}`}
                >
                  {o.label}
                </button>
              ))}
              <input
                type="number"
                min={1}
                step={0.1}
                inputMode="decimal"
                aria-label="Custom fee rate in sat per vbyte"
                value={feeMode === "custom" ? customFee : ""}
                placeholder="CUSTOM"
                onChange={(e) => { setFeeMode("custom"); setCustomFee(e.target.value); }}
                className={`w-20 border bg-background px-2 py-1 font-mono text-[10px] ${feeMode === "custom" ? "border-bitcoin" : "border-border"}`}
              />
            </div>
            {chosenFee !== undefined && chosenFee <= 1.5 ? (
              <p className="label text-muted-foreground">LOW FEES CAN TAKE HOURS OR DAYS TO CONFIRM. KEEP YOUR RECOVERY FILE.</p>
            ) : null}
          </div>
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
          <label className="label block cursor-pointer text-signal underline">
            ↺ ALREADY PAID? RESUME FROM YOUR RECOVERY FILE (NO NEW FEE)
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importRecovery(e.target.files?.[0])} />
          </label>
          {props.claimParentsForHeight !== undefined ? (
            <p className="label text-signal">
              ⧉ THIS {props.reinscribeOnBitmap ? "BUILD" : "CREATURE"} IS INSCRIBED AS A CHILD OF {props.claimParentsForHeight}.BITMAP AND OF THE BITMAPWIN COLLECTION. BOTH PARENTS PASS
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
            <div className="space-y-2">
              {!commitUtxo ? (
                <p className="text-signal">
                  {busy ?? (props.autoReveal
                    ? "STEP 1 · WAITING FOR YOUR PAYMENT TO APPEAR — THE REVEAL SIGNS BY ITSELF RIGHT AFTER"
                    : "STEP 1 · WAITING FOR YOUR FEE PAYMENT TO APPEAR…")}
                </p>
              ) : busy ? (
                <p className="text-signal">{busy}</p>
              ) : (
                <>
                  <p className="text-signal">
                    STEP 1 DONE · FEE PAYMENT SEEN. {needsWallet ? "STEP 2 · YOUR WALLET MUST SIGN THE BITMAP PARENT CLAIM (NO NEW FEE)." : ""}
                  </p>
                  {revealError ? <p className="text-destructive">{revealError}</p> : null}
                  <button
                    type="button"
                    className="border border-bitcoin px-3 py-2 label text-bitcoin hover:bg-bitcoin/10"
                    onClick={() => job && commitUtxo && void reveal(job, commitUtxo)}
                  >
                    {revealError ? "↻ RETRY SIGNING" : needsWallet ? "◆ STEP 2 · SIGN & BROADCAST REVEAL" : "◆ BROADCAST REVEAL"}
                  </button>
                </>
              )}
            </div>
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
