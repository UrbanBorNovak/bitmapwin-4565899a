import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  createKeys,
  exportKeys,
  forgetKeys,
  importKeys,
  loadKeys,
  shordHandle,
  type ShordKeys,
} from "@/lib/shord/keys";
import { SHORD_OP_LABEL } from "@/lib/shord/wire";
import { SHORD_KIND_LABEL } from "@/lib/shord/note-cipher";
import {
  SHORD_POOL_ADDRESS,
  chainTip,
  readShieldedTx,
  scanShieldedPool,
  type ShordChainNote,
} from "@/lib/shord/scanner";
import { proverStatus, type ProverStatus } from "@/lib/shord/prover";

export const Route = createFileRoute("/shord")({
  head: () => ({
    meta: [
      { title: "Shielded Vault — SHORD Zero-Knowledge Scanner — BITMAPWIN" },
      {
        name: "description",
        content:
          "Scan shielded ordinal transfers straight off Bitcoin L1, decrypt the notes that belong to your device keys, and keep everything else opaque.",
      },
      { property: "og:title", content: "Shielded Vault — SHORD Zero-Knowledge Scanner — BITMAPWIN" },
      {
        property: "og:description",
        content: "Sovereign device keys, live pool scanning and note decryption for shielded ordinals on Bitcoin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShieldedVaultPage,
});

const num = (n: number) => n.toLocaleString("en-US");

function Field({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="label text-muted-foreground">{label}</dt>
      <dd className={`break-all font-mono text-[10px] ${tone}`}>{value}</dd>
    </div>
  );
}

function NoteCard({ note }: { note: ShordChainNote }) {
  const env = note.envelope;
  const mine = note.body !== null;
  return (
    <article
      className={`border p-3 backdrop-blur-sm ${mine ? "border-bitcoin/60 bg-bitcoin/5" : "border-border bg-card/60"}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label text-signal">{SHORD_OP_LABEL[env.op]}</p>
          <h2 className="font-display text-sm text-foreground">
            {mine ? "OPENED WITH YOUR VIEWING KEY" : "SEALED — NOT FOR THIS KEY"}
          </h2>
        </div>
        <span
          className={`label border px-2 py-0.5 ${
            note.confirmed
              ? "border-bitcoin/50 bg-bitcoin/10 text-bitcoin"
              : "animate-pulse border-signal/50 bg-signal/10 text-signal"
          }`}
        >
          {note.confirmed ? `◆ BLOCK ${note.blockHeight ?? "—"}` : "◌ IN MEMPOOL"}
        </span>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <Field label="ANCHOR ROOT" value={`${env.anchor.slice(0, 12)}…`} />
        <Field label="NULLIFIER" value={`${env.nullifier.slice(0, 12)}…`} />
        <Field label="COMMITMENT" value={`${env.commitment.slice(0, 12)}…`} />
        <Field label="ONE-TIME DH KEY" value={`${env.ephemeral.slice(0, 12)}…`} />
        <Field label="PROOF" value="GROTH16 · 256 B" tone="text-signal" />
        <Field label="CIPHERTEXT" value={`${env.ciphertext.length / 2} B AEAD`} tone="text-signal" />
        <Field label="MINER FEE" value={`${num(note.fee)} SATS`} />
        <Field label="CARRIED" value={`${num(note.outputValue)} SATS`} />
      </dl>

      {note.body ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border border-bitcoin/40 bg-background/40 p-2 sm:grid-cols-4">
          <Field label="ASSET" value={SHORD_KIND_LABEL[note.body.kind] ?? "UNKNOWN"} tone="text-bitcoin" />
          <Field label="LAND" value={`${note.body.height}.BITMAP`} tone="text-bitcoin" />
          <Field label="SLOT" value={String(note.body.index)} />
          <Field label="VALUE" value={`${num(note.body.value)} SATS`} />
        </dl>
      ) : null}

      <a
        href={`https://mempool.space/tx/${note.txid}`}
        target="_blank"
        rel="noreferrer"
        className="label mt-2 inline-block break-all text-signal hover:text-bitcoin"
      >
        {note.txid.slice(0, 20)}… · OPEN ON MEMPOOL.SPACE →
      </a>
    </article>
  );
}

function KeyPanel({ keys, onChange }: { keys: ShordKeys | null; onChange: (k: ShordKeys | null) => void }) {
  const [backup, setBackup] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!keys) {
    return (
      <section className="border border-border bg-card/60 p-4">
        <p className="label text-signal">STEP 1 · SOVEREIGN KEYS</p>
        <h2 className="font-display text-lg text-foreground">NO SHIELDED KEY ON THIS DEVICE</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Your shielded key is made here in the browser and never leaves it. Nothing is linked to a wallet, an email or
          an account. Keep the backup safe: whoever holds it holds the shielded assets.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(createKeys())}
            className="label border border-bitcoin bg-bitcoin/10 px-3 py-1.5 text-bitcoin hover:bg-bitcoin/20"
          >
            CREATE SHIELDED KEY
          </button>
        </div>
        <div className="mt-3">
          <label className="label text-muted-foreground" htmlFor="shord-import">
            OR RESTORE FROM BACKUP
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="shord-import"
              value={backup}
              onChange={(e) => setBackup(e.target.value)}
              placeholder="SHORD-KEY-v1.…"
              className="min-w-[18rem] flex-1 border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
            />
            <button
              type="button"
              onClick={() => {
                const restored = importKeys(backup);
                if (!restored) setError("THAT BACKUP CODE IS NOT VALID");
                else {
                  setError(null);
                  onChange(restored);
                }
              }}
              className="label border border-border px-3 py-1.5 text-signal hover:text-bitcoin"
            >
              RESTORE
            </button>
          </div>
          {error ? <p className="label mt-1 text-destructive">{error}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="border border-border bg-card/60 p-4">
      <p className="label text-signal">SOVEREIGN KEYS · THIS DEVICE ONLY</p>
      <h2 className="font-display text-lg text-foreground">{shordHandle(keys.publicKey)}</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="SHIELDED ADDRESS (SHARE THIS)" value={keys.address} tone="text-bitcoin" />
        <Field label="PUBLIC KEY" value={keys.publicKey} />
        <Field label="VIEWING KEY (SCAN + DECRYPT)" value={revealed ? keys.viewing : "•••••• HIDDEN"} />
        <Field label="SPENDING KEY" value={revealed ? keys.spend : "•••••• HIDDEN"} tone="text-destructive" />
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="label border border-border px-3 py-1.5 text-signal hover:text-bitcoin"
        >
          {revealed ? "HIDE SECRETS" : "REVEAL SECRETS"}
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(keys.address)}
          className="label border border-border px-3 py-1.5 text-signal hover:text-bitcoin"
        >
          COPY ADDRESS
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(exportKeys(keys))}
          className="label border border-bitcoin bg-bitcoin/10 px-3 py-1.5 text-bitcoin hover:bg-bitcoin/20"
        >
          COPY BACKUP CODE
        </button>
        <button
          type="button"
          onClick={() => {
            forgetKeys();
            onChange(null);
          }}
          className="label border border-destructive/50 px-3 py-1.5 text-destructive hover:bg-destructive/10"
        >
          FORGET ON THIS DEVICE
        </button>
      </div>
    </section>
  );
}

function ShieldedVaultPage() {
  const [keys, setKeys] = useState<ShordKeys | null>(null);
  const [lookup, setLookup] = useState("");
  const [lookupNote, setLookupNote] = useState<ShordChainNote | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [prover, setProver] = useState<ProverStatus | null>(null);

  useEffect(() => {
    setKeys(loadKeys());
    void proverStatus().then(setProver);
  }, []);

  const scalar = useMemo(() => (keys ? BigInt(keys.spend) : null), [keys]);

  const scan = useQuery({
    queryKey: ["shord", "pool", keys?.publicKey ?? "read-only"],
    queryFn: () => scanShieldedPool({ scalar, pages: 2 }),
    refetchInterval: 90_000,
  });
  const tip = useQuery({ queryKey: ["shord", "tip"], queryFn: chainTip, refetchInterval: 120_000 });

  const notes = scan.data ?? [];
  const mine = notes.filter((n) => n.body !== null);

  const doLookup = useCallback(async () => {
    setLookupError(null);
    setLookupNote(null);
    try {
      const note = await readShieldedTx(lookup, scalar);
      if (!note) setLookupError("THAT TRANSACTION CARRIES NO SHORD NOTE");
      else setLookupNote(note);
    } catch {
      setLookupError("COULD NOT READ BITCOIN RIGHT NOW");
    }
  }, [lookup, scalar]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="border-b border-border pb-4">
        <p className="label text-signal">SHIELDED ORDINALS · BITCOIN L1</p>
        <h1 className="font-display text-2xl text-foreground">SHIELDED VAULT</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Shielded transfers all spend from one shared Bitcoin output and carry their whole state inside a sealed
          462-byte note. Your device keys decide which of those notes open. Everything else stays sealed forever — that
          is the point.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px]">
          <span className="label border border-border px-2 py-0.5 text-muted-foreground">
            CHAIN TIP {tip.data ?? "—"}
          </span>
          <span className="label border border-signal/40 px-2 py-0.5 text-signal">{notes.length} NOTES SEEN</span>
          <span className="label border border-bitcoin/40 px-2 py-0.5 text-bitcoin">{mine.length} YOURS</span>
          <button type="button" onClick={() => void scan.refetch()} className="label text-signal hover:text-bitcoin">
            SCAN AGAIN
          </button>
          <Link to="/shadow-notes" className="label text-signal hover:text-bitcoin">
            SHADOW PASS NOTES →
          </Link>
        </div>
      </header>

      <div className="mt-5 space-y-5">
        <KeyPanel keys={keys} onChange={setKeys} />

        <section className="border border-border bg-card/60 p-4">
          <p className="label text-signal">STEP 2 · LIVE POOL SCAN</p>
          <h2 className="font-display text-lg text-foreground">SHARED SHIELDED POOL</h2>
          <p className="break-all font-mono text-[10px] text-muted-foreground">{SHORD_POOL_ADDRESS}</p>
          {scan.isLoading ? (
            <p className="label mt-4 text-muted-foreground">READING BITCOIN…</p>
          ) : scan.isError ? (
            <p className="label mt-4 text-destructive">COULD NOT READ BITCOIN RIGHT NOW — TRY SCAN AGAIN</p>
          ) : notes.length === 0 ? (
            <p className="label mt-4 text-muted-foreground">NO SHIELDED NOTES FOUND IN THIS WINDOW</p>
          ) : (
            <div className="mt-4 space-y-3">
              {notes.map((note) => (
                <NoteCard key={note.txid} note={note} />
              ))}
            </div>
          )}
        </section>

        <section className="border border-border bg-card/60 p-4">
          <p className="label text-signal">INSPECT ANY TRANSACTION</p>
          <h2 className="font-display text-lg text-foreground">DECODE A SHIELDED TRANSFER</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="TRANSACTION ID"
              className="min-w-[18rem] flex-1 border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
            />
            <button
              type="button"
              onClick={() => void doLookup()}
              className="label border border-bitcoin bg-bitcoin/10 px-3 py-1.5 text-bitcoin hover:bg-bitcoin/20"
            >
              DECODE
            </button>
          </div>
          {lookupError ? <p className="label mt-2 text-destructive">{lookupError}</p> : null}
          {lookupNote ? (
            <div className="mt-3">
              <NoteCard note={lookupNote} />
            </div>
          ) : null}
        </section>

        <section className="border border-border bg-card/60 p-4">
          <p className="label text-signal">STEP 3 · SPEND PROVING</p>
          <h2 className="font-display text-lg text-foreground">ZERO-KNOWLEDGE PROVER</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Sending a shielded asset needs a proof built on this device against the pool's own circuit. Scanning,
            decrypting and inspecting work without it; sending does not.
          </p>
          <p className="label mt-3">
            {prover === null ? (
              <span className="text-muted-foreground">◌ CHECKING…</span>
            ) : prover.ready ? (
              <span className="text-bitcoin">◆ PROVER READY</span>
            ) : (
              <span className="text-destructive">✕ PROVING OFFLINE · {prover.reason}</span>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
