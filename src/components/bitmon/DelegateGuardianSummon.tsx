/**
 * Delegate summon: a near-empty child inscription that points (tag 11) at the
 * master generator and claims the holder's `<height>.bitmap` as parent (tag 3).
 * The tribute is paid inside the same reveal, so the master generator can
 * verify both on chain and awaken the Guardian in full colour by itself.
 */
import { ShadowInscriber, type ArtifactVariant } from "@/components/territory/ShadowInscriber";
import { DELEGATE_CONTENT_TYPE, GUARDIAN_MASTER_DELEGATE_ID, GUARDIAN_MASTER_DELEGATE_IDS, GUARDIAN_V7_MASTER_ID, MINT_TRIBUTE_ADDRESS, TRIBUTE_SATS, guardianMasterGeneratorHtml } from "@/lib/guardian-delegate";
import { useState } from "react";
import { InscriptionWatcher } from "@/components/bitmon/InscriptionWatcher";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { allGuardiansQuery, guardianQuery } from "@/lib/bitmon-queries";
import { verifyDelegateGuardianFn } from "@/lib/bitmon.functions";
import { guardianArtifactSvg, guardianShieldDigest, type GuardianDna } from "@/lib/bitmon";

const STEPS = [
  ["A", "PARENT", "Your BITMAP is spent into the reveal and returned to your own address in the same transaction."],
  ["B", "TRIBUTE", `${TRIBUTE_SATS.toLocaleString("en-US")} sats go to the BITMAPWIN treasury in output 1 of the reveal.`],
  ["C", "AWAKENS", "The master generator reads its parent and tribute on chain and draws the full-colour Guardian."],
] as const;

export function DelegateGuardianSummon({ dna }: { dna: GuardianDna }) {
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [engine, setEngine] = useState(GUARDIAN_MASTER_DELEGATE_ID);
  const inhabited = useQuery(inhabitedQuery());
  const g = useQuery(guardianQuery(dna.height));
  const onChainId = inhabited.data?.get(dna.height) ?? g.data?.inscriptionId ?? null;
  if (!GUARDIAN_MASTER_DELEGATE_ID) {
    return <p className="font-mono text-xs text-muted-foreground">DELEGATE SUMMONS ARE NOT OPEN YET.</p>;
  }
  // No summon order exists for a delegate mint, so the commitment is bound to
  // the master generator instead of a payment txid.
  const anchor = `delegate:${GUARDIAN_MASTER_DELEGATE_ID}`;
  const digest = guardianShieldDigest(dna, anchor);
  const variants: ArtifactVariant[] = [
    {
      key: "delegate",
      label: "◈ DELEGATE GUARDIAN",
      contentType: DELEGATE_CONTENT_TYPE,
      source: guardianMasterGeneratorHtml(),
      delegate: engine,
      tribute: { address: MINT_TRIBUTE_ADDRESS, sats: TRIBUTE_SATS },
      note: `EMPTY BODY + DELEGATE TAG. THE MASTER GENERATOR CHECKS THE ${dna.height}.BITMAP PARENT AND THE ${TRIBUTE_SATS.toLocaleString("en-US")}-SAT TRIBUTE INSIDE THIS TRANSACTION.`,
    },
  ];

  return (
    <div className="space-y-3">
      {onChainId ? (
        <div className="border border-signal p-2 font-mono text-[11px]">
          <p className="text-signal">✓ ALREADY INSCRIBED ON BITCOIN · CHILD OF {dna.height}.BITMAP</p>
          <a href={`https://ordinals.com/inscription/${onChainId}`} target="_blank" rel="noreferrer" className="break-all text-bitcoin underline">{onChainId} ↗</a>
          <p className="mt-1 text-[10px] text-muted-foreground">THE FIRST INSCRIBED GUARDIAN FOR A BLOCK IS THE ONE. INSCRIBING AGAIN BELOW MAKES AN EXTRA COPY ON A NEWER ENGINE; IT NEVER BECOMES A SECOND GUARDIAN.</p>
        </div>
      ) : inhabited.isPending ? <p className="font-mono text-[10px] text-muted-foreground">CHECKING THE CHAIN FOR AN EXISTING GUARDIAN…</p> : (
        <p className="font-mono text-[11px] text-bitcoin">NOT INSCRIBED YET · {dna.height}.BITMAP HAS NO ON-CHAIN GUARDIAN</p>
      )}
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
        <span className="text-muted-foreground">ENGINE</span>
        {GUARDIAN_MASTER_DELEGATE_IDS.slice(0, 2).map((id) => (
          <button key={id} type="button" onClick={() => setEngine(id)} className={`border px-2 py-1 ${engine === id ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>
            {id === GUARDIAN_MASTER_DELEGATE_ID ? "V8 THREE.JS · NEWEST" : id === GUARDIAN_V7_MASTER_ID ? "V7" : id.slice(0, 8)}
          </button>
        ))}
        <span className="text-muted-foreground">NEW ENGINES APPEAR HERE WHEN INSCRIBED</span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map(([n, t, note]) => (
          <li key={n} className="border border-border p-2">
            <p className="font-mono text-[10px] text-bitcoin">{n} · {t}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </li>
        ))}
      </ol>
      <ShadowInscriber
        slug={`guardian-delegate-${dna.height}`}
        height={dna.height}
        index={0}
        digest={digest}
        artifactSvg={guardianArtifactSvg(dna, anchor)}
        artifactVariants={variants}
        artifactLabel="DELEGATE GUARDIAN"
        actionLabel="◆ INSCRIBE FULL-COLOUR GUARDIAN"
        description={`ONLY THE WALLET HOLDING ${dna.height}.BITMAP CAN SIGN THIS. WITHOUT A VALID BITMAP PARENT OR TRIBUTE, THE INSCRIPTION RENDERS AS A STONE RELIC. YOUR WALLET PAYS THE LIVE MINER FEE.`}
        allowUpload={false}
        claimParentsForHeight={dna.height}
        requireAwake
        onRevealed={(revealTxid) => setRevealedId(`${revealTxid}i0`)}
      />
      {revealedId ? <InscriptionWatcher inscriptionId={revealedId} height={dna.height} /> : null}
      <ClaimAwakening />
      <TributesPaid />
    </div>
  );
}

/** Guardians the server verified on chain: each one paid its tribute inside the reveal. */
function TributesPaid() {
  const roster = useQuery(allGuardiansQuery());
  const paid = (roster.data ?? []).filter((r) => r.inscriptionId);
  return (
    <details className="border border-border p-2">
      <summary className="cursor-pointer font-mono text-[10px] text-signal">TRIBUTES PAID · {roster.data ? paid.length : "…"} INSCRIBED GUARDIANS</summary>
      {paid.length ? (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {paid.map((r) => (
            <li key={r.height} className="flex justify-between gap-2 font-mono text-[10px]">
              <span className="text-bitcoin">{r.height}.BITMAP ✓</span>
              <a href={`https://ordinals.com/inscription/${r.inscriptionId}`} target="_blank" rel="noreferrer" className="text-muted-foreground underline">{r.inscriptionId!.slice(0, 8)}…{r.inscriptionId!.slice(-3)} ↗</a>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 font-mono text-[10px] text-muted-foreground">{roster.isPending ? "READING…" : "NONE VERIFIED YET"}</p>}
    </details>
  );
}

function ClaimAwakening() {
  const verify = useServerFn(verifyDelegateGuardianFn);
  const qc = useQueryClient();
  const [id, setId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oasis, setOasis] = useState<number | null>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await verify({ data: { inscriptionId: id.trim() } });
      setMsg(r.awakened ? `GUARDIAN AWAKE ON ${r.height}.BITMAP` : r.denied);
      if (r.awakened) {
        qc.invalidateQueries({ queryKey: ["guardians"] });
        if (r.height != null) qc.invalidateQueries({ queryKey: ["guardian", r.height] });
        if (r.height != null) setOasis(r.height);
      }
    } catch { setMsg("PASTE A FULL INSCRIPTION ID (…i0)"); }
    setBusy(false);
  };
  return (
    <div className="space-y-2 border border-border p-2">
      <p className="font-mono text-[10px] text-signal">ALREADY INSCRIBED? AWAKEN IT FROM CHAIN PROOF</p>
      <div className="flex gap-2">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="INSCRIPTION ID …i0" className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-xs" />
        <button type="button" disabled={busy || !id.trim()} onClick={run} className="border border-bitcoin px-2 font-mono text-[10px] text-bitcoin disabled:opacity-50">{busy ? "CHECKING…" : "[ VERIFY ]"}</button>
      </div>
      {msg ? <p className="font-mono text-[10px] text-muted-foreground">{msg}</p> : null}
      {oasis != null ? (
        <Link to="/oasis" search={{ height: oasis }} className="inline-block font-mono text-[10px] text-bitcoin hover:text-foreground">
          → MEET IT ON {oasis}.BITMAP IN THE OASIS
        </Link>
      ) : null}
    </div>
  );
}
