import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { liveBitmapFn } from "@/lib/bw-matter.functions";
import { bitchatRelayStatus, postBitmapRoom, subscribeBitmapRoom, type BitchatLine } from "@/lib/nostr/bitchat-bridge";

const RELAY_GH = "u2mwt";
const FAMOUS = [0, 9, 715093, 717328, 840000];

export const Route = createFileRoute("/bitchat")({
  head: () => ({
    meta: [
      { title: "BITMAP Rooms on BitChat · BitmapWin" },
      { name: "description", content: "Chat in a room for every BITMAP block, checked live against the on-chain LiveOCI index and sent over BitChat's Nostr relays." },
      { property: "og:title", content: "BITMAP Rooms on BitChat" },
      { property: "og:description", content: "One chat room per BITMAP block, verified live from LiveOCI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BitchatRooms,
});

type Dossier = { inscriptionId: string | null; sat: number | null; source: string | null; error: string | null };

function BitchatRooms() {
  const lookup = useServerFn(liveBitmapFn);
  const [input, setInput] = useState("715093");
  const [height, setHeight] = useState<number | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [lines, setLines] = useState<BitchatLine[]>([]);
  const [nick, setNick] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [connected, setConnected] = useState(0);
  const [relayCount, setRelayCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const open = (h: number) => { setHeight(h); setInput(String(h)); };

  useEffect(() => {
    if (height == null) return;
    setLines([]); setDossier(null); setStatus("");
    let alive = true;
    lookup({ data: { height } }).then((d) => alive && setDossier(d)).catch(() => alive && setDossier({ inscriptionId: null, sat: null, source: null, error: "LiveOCI lookup failed" }));
    const seen = new Set<string>();
    const stop = subscribeBitmapRoom(height, RELAY_GH, (l) => {
      if (seen.has(l.id)) return; seen.add(l.id);
      setLines((p) => [...p, l].sort((a, b) => a.at - b.at).slice(-200));
    });
    const t = setInterval(() => { const s = bitchatRelayStatus(RELAY_GH); setRelayCount(s.length); setConnected(s.filter((x) => x.connected).length); }, 2000);
    return () => { alive = false; stop(); clearInterval(t); };
  }, [height, lookup]);

  useEffect(() => { listRef.current?.scrollTo({ top: 1e9 }); }, [lines.length]);

  const send = async () => {
    if (height == null || !text.trim()) return;
    setStatus("SENDING…");
    try {
      const r = await postBitmapRoom(height, RELAY_GH, nick, text);
      if (r.outcome.accepted.length) { setLines((p) => [...p, r.line]); setText(""); setStatus(`✓ ACCEPTED BY ${r.outcome.accepted.length}/${r.outcome.of} RELAYS`); }
      else setStatus(`✕ NOT SENT (${r.outcome.rejected[0]?.reason ?? "no relay answered"})`);
    } catch (e) { setStatus(`✕ NOT SENT (${(e as Error).message})`); }
  };

  const submitRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(input.trim().replace(/\.bitmap$/i, "").replace(/^#/, ""));
    if (Number.isInteger(h) && h >= 0 && h < 2_000_000) open(h);
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-3 px-3 py-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl text-foreground">⚡ BITMAP ROOMS</h1>
        <span className="font-mono text-[11px] text-muted-foreground">BITCHAT RELAYS · LIVEOCI</span>
      </header>

      <form onSubmit={submitRoom} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric" placeholder="Block number, e.g. 715093"
          className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-foreground" />
        <button className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground">ENTER</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {FAMOUS.map((h) => (
          <button key={h} onClick={() => open(h)} className={`rounded-full border px-3 py-1 font-mono text-xs ${height === h ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>#{h}</button>
        ))}
      </div>

      {height == null ? (
        <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">Pick a block to open its room. Every BITMAP block has its own chat room.</p>
      ) : (
        <>
          <section className="rounded-md border border-border bg-card p-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-base text-foreground">{height}.bitmap</span>
              <span className={connected ? "text-signal" : "text-destructive"}>● {connected}/{relayCount} RELAYS</span>
            </div>
            {!dossier ? <p className="mt-1 text-muted-foreground">Checking LiveOCI…</p>
              : dossier.inscriptionId ? (
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  <p>CANONICAL: <a className="text-signal underline" href={`https://ordinals.com/inscription/${dossier.inscriptionId}`} target="_blank" rel="noreferrer">{dossier.inscriptionId.slice(0, 10)}…{dossier.inscriptionId.slice(-4)}</a></p>
                  {dossier.sat != null && <p>SAT: {dossier.sat.toLocaleString("en-US")}</p>}
                  <p>SOURCE: {dossier.source}</p>
                  <Link to="/slab" search={{ h: height } as never} className="text-primary underline">View land slab →</Link>
                </div>
              ) : <p className="mt-1 text-muted-foreground">{dossier.error ?? "No canonical BITMAP found for this block — chat still works."}</p>}
          </section>

          <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto rounded-md border border-border bg-card p-3 text-sm" style={{ minHeight: "16rem", maxHeight: "50dvh" }}>
            {lines.length === 0 ? <p className="text-muted-foreground">No messages in the last hour. Say hello.</p> : lines.map((l) => (
              <p key={l.id} className="break-words"><span className={`font-mono text-xs ${l.mine ? "text-primary" : "text-signal"}`}>{l.nick}</span> <span className="text-foreground">{l.text}</span></p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Nickname (optional)" maxLength={24}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground" />
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`Message #${height}`} maxLength={500}
                className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground" />
              <button onClick={send} className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground">SEND</button>
            </div>
            {status && <p className="font-mono text-[11px] text-muted-foreground">{status}</p>}
            <p className="font-mono text-[10px] text-muted-foreground">✓ ACCEPTED means a relay took it, not that anyone read it. BITMAP rooms use BitChat's relays and message format; the BitChat phone app does not list these rooms yet, so phone users only see its location channels.</p>
          </div>
        </>
      )}
    </main>
  );
}
