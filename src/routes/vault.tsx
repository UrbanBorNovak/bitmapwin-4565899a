import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SealedVault } from "@/components/shadow/SealedVault";
import { RelicInspector } from "@/components/shadow/RelicInspector";
import {
  decodeNote, encodeNote, loadNotes, mintNote, ownerCommit, receiveSecret, rotateReceive, saveNotes, transferNote, verifyNote,
  type HeldNote,
} from "@/lib/shadow-notes";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "Shadow Vault — Device-Held Notes — BITMAPWIN" },
      { name: "description", content: "Keep private items on your own device, hand them to anyone with a code, and check every note's history yourself. No server sees them." },
      { property: "og:title", content: "Shadow Vault — Device-Held Notes — BITMAPWIN" },
      { property: "og:description", content: "Private, device-held notes you can give away and verify yourself. No account, no server copy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VaultPage,
});

const short = (s: string) => `${s.slice(0, 8)}…${s.slice(-6)}`;

function VaultPage() {
  const [notes, setNotes] = useState<HeldNote[]>([]);
  const [recv, setRecv] = useState("");
  const [label, setLabel] = useState("");
  const [paste, setPaste] = useState("");
  const [sendTo, setSendTo] = useState<Record<number, string>>({});
  const [out, setOut] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { setNotes(loadNotes()); setRecv(ownerCommit(receiveSecret())); }, []);
  const store = (l: HeldNote[]) => { saveNotes(l); setNotes(l); };

  function mint() {
    if (!label.trim()) return;
    const secret = crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
    store([...notes, { note: mintNote(label.trim().slice(0, 60), "memo", secret), secret }]);
    setLabel(""); setMsg("NOTE CREATED ON THIS DEVICE");
  }
  function accept() {
    const n = decodeNote(paste);
    if (!n || !verifyNote(n)) return setMsg("✗ THAT NOTE'S HISTORY DOES NOT CHECK OUT");
    const secret = receiveSecret();
    if (n.chain.at(-1)!.to !== ownerCommit(secret)) return setMsg("✗ THIS NOTE WAS SENT TO A DIFFERENT RECEIVE CODE");
    if (notes.some((x) => x.note.chain.at(-1)!.hash === n.chain.at(-1)!.hash)) return setMsg("ALREADY IN YOUR VAULT");
    store([...notes, { note: n, secret }]); rotateReceive(); setRecv(ownerCommit(receiveSecret()));
    setPaste(""); setMsg(`✓ RECEIVED "${n.label}" · ${n.chain.length - 1} VERIFIED HANDOFFS`);
  }
  function send(i: number) {
    try {
      const moved = transferNote(notes[i]!, (sendTo[i] ?? "").trim());
      setOut(encodeNote(moved)); store(notes.filter((_, k) => k !== i));
      setMsg("NOTE SEALED TO THE RECIPIENT — SEND THEM THE CODE BELOW. IT HAS LEFT YOUR VAULT.");
    } catch (e) { setMsg(`✗ ${(e as Error).message}`); }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-mono text-sm">
      <p className="text-[11px] tracking-[0.3em] text-signal">IDENTITY · SHADOW</p>
      <h1 className="mt-2 font-display text-4xl text-foreground">SHADOW VAULT</h1>
      <p className="mt-3 max-w-2xl font-sans text-muted-foreground">Notes live only on this device. Each one carries its full history, and your browser checks it before accepting it. Nothing is sent to BITMAPWIN.</p>
      <p className="mt-2 max-w-2xl font-sans text-[12px] text-muted-foreground">Honest limit: notes aren't anchored to Bitcoin yet, so someone who kept a copy could give the same note twice. Back up this device's storage — clearing it loses your notes.</p>

      <RelicInspector />
      <section className="mt-8 rounded border border-border bg-card/60 p-4">
        <div className="text-[11px] tracking-widest text-signal">YOUR RECEIVE CODE</div>
        <div aria-label="Receive code" className="mt-2 break-all text-foreground" data-no-translate>{recv || "…"}</div>
        <button onClick={() => navigator.clipboard.writeText(recv)} className="mt-2 text-[11px] text-primary">[ COPY ]</button>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-border bg-card/60 p-4">
          <div className="text-[11px] tracking-widest text-signal">NEW NOTE</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Secret map to 1138" className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5" />
          <button onClick={mint} className="mt-2 rounded border border-primary bg-primary/15 px-3 py-1.5 text-[12px] text-primary">[ CREATE ]</button>
        </div>
        <div className="rounded border border-border bg-card/60 p-4">
          <div className="text-[11px] tracking-widest text-signal">RECEIVE A NOTE</div>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="SHADOW-NOTE-v1.…" rows={2} className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5 text-[11px]" />
          <button onClick={accept} className="mt-2 rounded border border-primary bg-primary/15 px-3 py-1.5 text-[12px] text-primary">[ CHECK & ACCEPT ]</button>
        </div>
      </section>

      {msg ? <p className="mt-4 text-[12px] text-signal">{msg}</p> : null}
      {out ? <textarea readOnly value={out} rows={3} onFocus={(e) => e.target.select()} className="mt-2 w-full rounded border border-primary/60 bg-background px-2 py-1.5 text-[11px]" data-no-translate /> : null}

      <section className="mt-8">
        <div className="text-[11px] tracking-widest text-signal">IN YOUR VAULT · {notes.length}</div>
        {notes.length === 0 ? <p className="mt-2 text-muted-foreground">&gt; EMPTY_</p> : notes.map((h, i) => (
          <div key={h.note.chain.at(-1)!.hash} className="mt-2 rounded border border-border bg-card/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-foreground">{h.note.label}</span>
              <span className={`text-[11px] ${verifyNote(h.note) ? "text-signal" : "text-destructive"}`}>{verifyNote(h.note) ? "✓ HISTORY VALID" : "✗ BROKEN"} · {h.note.chain.length - 1} HANDOFFS · {short(h.note.genesis)}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <input value={sendTo[i] ?? ""} onChange={(e) => setSendTo({ ...sendTo, [i]: e.target.value })} placeholder="Recipient's receive code" className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[11px]" />
              <button onClick={() => send(i)} className="rounded border border-border px-3 py-1 text-[11px] hover:border-primary hover:text-primary">[ GIVE ]</button>
            </div>
          </div>
        ))}
      </section>
      <SealedVault />
      <Link to="/passport" className="mt-8 inline-block text-[11px] text-signal">← PASSPORT</Link>
    </main>
  );
}
