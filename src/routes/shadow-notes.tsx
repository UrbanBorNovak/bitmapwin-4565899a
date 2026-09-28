import { useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMempoolWatch } from "@/lib/use-mempool-watch";
import { getAllShadowNotesFn } from "@/lib/shadow-l1.functions";
import { mempoolTxUrl } from "@/lib/shadow-l1";
import { SHADOW_OP_LABEL, decodeShadowNote } from "@/lib/shadow-wire";
import type { ShadowNoteLive } from "@/lib/shadow-l1.server";

export const Route = createFileRoute("/shadow-notes")({
  head: () => ({
    meta: [
      { title: "Shadow Pass Notes — Live Bitcoin L1 Anchors — BITMAPWIN" },
      {
        name: "description",
        content:
          "Every shielded SHAD note anchored onto Bitcoin, with its live mempool and block status read straight from public Bitcoin mirrors.",
      },
      { property: "og:title", content: "Shadow Pass Notes — Live Bitcoin L1 Anchors — BITMAPWIN" },
      {
        property: "og:description",
        content: "Live mempool and confirmation status for every shielded Shadow pass note written onto Bitcoin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShadowNotesDashboard,
});

const sats = (n: number) => n.toLocaleString("en-US");

function ago(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s AGO`;
  if (secs < 3600) return `${Math.round(secs / 60)}m AGO`;
  if (secs < 86_400) return `${Math.round(secs / 3600)}h AGO`;
  return `${Math.round(secs / 86_400)}d AGO`;
}

function StatusBadge({ note }: { note: ShadowNoteLive }) {
  if (note.status === "confirmed") {
    return (
      <span className="label border border-bitcoin/50 bg-bitcoin/10 px-2 py-0.5 text-bitcoin">
        ◆ ANCHORED · BLOCK {note.confirmedHeight ?? "—"}
        {note.confirmations > 0 ? ` · ${note.confirmations} CONF` : ""}
      </span>
    );
  }
  if (note.seen === false) {
    return (
      <span className="label border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-destructive">
        ✕ NOT SEEN BY ANY MIRROR
      </span>
    );
  }
  return (
    <span className="label animate-pulse border border-signal/50 bg-signal/10 px-2 py-0.5 text-signal">
      ◌ IN MEMPOOL · WAITING FOR A MINER
    </span>
  );
}

/** The 43 bytes, split into the parts the protocol actually reads. */
function Envelope({ payloadHex }: { payloadHex: string }) {
  const note = decodeShadowNote(payloadHex);
  return (
    <div className="mt-2 border border-border/50 bg-muted/20 p-2">
      <p className="break-all font-mono text-[10px] leading-relaxed">
        <span className="text-bitcoin">{payloadHex.slice(0, 8)}</span>
        <span className="text-signal">{payloadHex.slice(8, 10)}</span>
        <span className="text-foreground">{payloadHex.slice(10, 18)}</span>
        <span className="text-signal">{payloadHex.slice(18, 22)}</span>
        <span className="text-muted-foreground">{payloadHex.slice(22)}</span>
      </p>
      {note ? (
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[10px]">
          <span className="text-muted-foreground">MARK</span>
          <span className="text-bitcoin">SHAD</span>
          <span className="text-muted-foreground">KIND</span>
          <span className="text-signal">{SHADOW_OP_LABEL[note.op]}</span>
          <span className="text-muted-foreground">LAND</span>
          <span className="text-foreground">{note.height}.BITMAP</span>
          <span className="text-muted-foreground">SLOT</span>
          <span className="text-foreground">{note.index}</span>
        </div>
      ) : null}
    </div>
  );
}

function NoteCard({ note }: { note: ShadowNoteLive }) {
  return (
    <article className="border border-border bg-card/60 p-3 backdrop-blur-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label text-signal">{SHADOW_OP_LABEL[note.op]} NOTE</p>
          <h2 className="font-display text-sm text-foreground">
            {note.gateTitle ?? note.slug.toUpperCase()}
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            <Link to="/bitmap/$block" params={{ block: String(note.territoryBlock) }} className="hover:text-bitcoin">
              {note.territoryBlock}.BITMAP
            </Link>
            {" · SLOT "}
            {note.passIndex}
            {" · "}
            {ago(note.createdAt)}
          </p>
        </div>
        <StatusBadge note={note} />
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] sm:grid-cols-4">
        <div>
          <dt className="label text-muted-foreground">MINER FEE</dt>
          <dd className="text-foreground">{note.minerFeeSats === null ? "—" : `${sats(note.minerFeeSats)} SATS`}</dd>
        </div>
        <div>
          <dt className="label text-muted-foreground">SIZE</dt>
          <dd className="text-foreground">{note.vbytes === null ? "—" : `${sats(note.vbytes)} VB`}</dd>
        </div>
        <div>
          <dt className="label text-muted-foreground">FEE RATE</dt>
          <dd className="text-foreground">
            {note.minerFeeSats !== null && note.vbytes ? `${(note.minerFeeSats / note.vbytes).toFixed(2)} SAT/VB` : "—"}
          </dd>
        </div>
        <div>
          <dt className="label text-muted-foreground">FINGERPRINT</dt>
          <dd className="break-all text-muted-foreground">{note.digestHex.slice(0, 12)}…</dd>
        </div>
      </dl>

      <Envelope payloadHex={note.payloadHex} />

      <a
        href={mempoolTxUrl(note.txid)}
        target="_blank"
        rel="noreferrer"
        className="label mt-2 inline-block break-all text-signal hover:text-bitcoin"
      >
        {note.txid.slice(0, 20)}… · OPEN ON MEMPOOL.SPACE →
      </a>
    </article>
  );
}

function ShadowNotesDashboard() {
  const query = useQuery({
    queryKey: ["shadow-notes", "all"],
    queryFn: () => getAllShadowNotesFn(),
    refetchInterval: 60_000,
  });

  const notes = query.data?.notes ?? [];
  const pending = notes.filter((n) => n.status !== "confirmed");
  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);
  const watchState = useMempoolWatch(pending[0]?.txid ?? null, refetch);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="border-b border-border pb-4">
        <p className="label text-signal">SHIELDED NOTES · BITCOIN L1</p>
        <h1 className="font-display text-2xl text-foreground">SHADOW PASS NOTES</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every 43-byte SHAD note written onto Bitcoin, checked against public Bitcoin mirrors right now. Only hashes
          reach the chain — no wallet, account or secret appears here.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px]">
          <span className="label border border-border px-2 py-0.5 text-muted-foreground">
            CHAIN TIP {query.data?.tipHeight ?? "—"}
          </span>
          <span className="label border border-signal/40 px-2 py-0.5 text-signal">{pending.length} IN MEMPOOL</span>
          <span className="label border border-bitcoin/40 px-2 py-0.5 text-bitcoin">
            {notes.length - pending.length} ANCHORED
          </span>
          <span className="label text-muted-foreground">
            {watchState === "live"
              ? "◉ WATCHING BITCOIN LIVE"
              : watchState === "connecting"
                ? "◌ CONNECTING"
                : watchState === "offline"
                  ? "⚠ RECONNECTING"
                  : "◌ NOTHING PENDING"}
          </span>
          <button type="button" onClick={refetch} className="label text-signal hover:text-bitcoin">
            REFRESH NOW
          </button>
        </div>
      </header>

      {query.isLoading ? (
        <p className="label mt-8 text-muted-foreground">READING BITCOIN…</p>
      ) : query.isError ? (
        <p className="label mt-8 text-destructive">COULD NOT READ BITCOIN RIGHT NOW — TRY REFRESH</p>
      ) : notes.length === 0 ? (
        <p className="label mt-8 text-muted-foreground">NO SHADOW NOTES ANCHORED YET</p>
      ) : (
        <div className="mt-5 space-y-3">
          {notes.map((note) => (
            <NoteCard key={note.txid} note={note} />
          ))}
        </div>
      )}
    </main>
  );
}
