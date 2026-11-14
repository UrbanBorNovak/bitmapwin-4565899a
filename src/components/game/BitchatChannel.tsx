import { useEffect, useRef, useState } from "react";
import type { Event } from "nostr-tools/pure";
import {
  bitchatRelayStatus, encodeGeohash, isGeohash, publishBitchat, sendStateFrom, signBitchat, subscribeBitchat, toLine,
  type BitchatLine, type SendState,
} from "@/lib/nostr/bitchat-bridge";

const GH_KEY = "bitmap.bitchat.geohash";
const NICK_KEY = "bitmap.bitchat.nick";
const time = (s: number) => new Date(s * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const host = (u: string) => u.replace("wss://", "");

function StatusTag({ s, onRetry }: { s: SendState; onRetry: () => void }) {
  if (s.kind === "sending") return <span className="text-muted-foreground"> · SENDING…</span>;
  if (s.kind === "accepted")
    return (
      <span className="text-signal" title={`Accepted by: ${s.outcome.accepted.map(host).join(", ")}. Relay acceptance is not a read receipt.`}>
        {" "}· ✓ ACCEPTED BY {s.outcome.accepted.length}/{s.outcome.of} RELAYS
      </span>
    );
  return (
    <span className="text-destructive" title={s.outcome?.rejected.map((r) => `${host(r.url)}: ${r.reason}`).join("\n")}>
      {" "}· ✕ NOT SENT ({s.reason}) <button onClick={onRetry} className="underline hover:text-bitcoin">RETRY</button>
    </span>
  );
}

/** Live BitChat #geohash channel: same room BitChat phone users see. */
export function BitchatChannel() {
  const [gh, setGh] = useState("");
  const [draftGh, setDraftGh] = useState("");
  const [nick, setNick] = useState("");
  const [lines, setLines] = useState<BitchatLine[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [status, setStatus] = useState<Record<string, SendState>>({});
  const [relays, setRelays] = useState<{ url: string; connected: boolean }[]>([]);
  const signed = useRef(new Map<string, Event>());
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const g = localStorage.getItem(GH_KEY) ?? "";
    setGh(g); setDraftGh(g); setNick(localStorage.getItem(NICK_KEY) ?? "");
  }, []);
  useEffect(() => {
    if (!gh) return;
    setLines([]); setStatus({});
    const seen = new Set<string>();
    const stop = subscribeBitchat(gh, (l) => {
      if (seen.has(l.id)) return; seen.add(l.id);
      setLines((m) => (m.some((x) => x.id === l.id) ? m : [...m, l].sort((a, b) => a.at - b.at).slice(-120)));
    });
    const tick = () => setRelays(bitchatRelayStatus(gh));
    tick();
    const id = window.setInterval(tick, 2000);
    return () => { stop(); window.clearInterval(id); };
  }, [gh]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [lines.length]);

  const online = relays.filter((r) => r.connected).length;

  const join = (g: string) => {
    const v = g.trim().toLowerCase();
    if (!isGeohash(v)) { setErr("GEOHASH MUST BE 2–7 CHARACTERS"); return; }
    setErr(null); setGh(v); setDraftGh(v); localStorage.setItem(GH_KEY, v);
  };
  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => join(encodeGeohash(p.coords.latitude, p.coords.longitude, 5)),
    () => setErr("LOCATION NOT SHARED"),
  );

  const publish = async (e: Event) => {
    setStatus((s) => ({ ...s, [e.id]: { kind: "sending" } }));
    try {
      const outcome = await publishBitchat(gh, e);
      setStatus((s) => ({ ...s, [e.id]: sendStateFrom(outcome) }));
    } catch (x) {
      setStatus((s) => ({ ...s, [e.id]: { kind: "failed", reason: x instanceof Error ? x.message : "ERROR" } }));
    }
  };

  const send = async () => {
    if (!text.trim() || preparing) return;
    setErr(null); setPreparing(true);
    try {
      localStorage.setItem(NICK_KEY, nick);
      const e = await signBitchat(gh, nick, text);
      signed.current.set(e.id, e);
      setText("");
      setLines((m) => [...m, { ...toLine(e), mine: true }]);
      void publish(e);
    } catch (x) { setErr(x instanceof Error ? x.message : "NOT SENT"); } finally { setPreparing(false); }
  };

  return (
    <div className="flex flex-col gap-1 p-2 font-mono text-[10px]">
      <div className="flex gap-1">
        <input value={draftGh} onChange={(e) => setDraftGh(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join(draftGh)}
          placeholder="geohash e.g. u2mw" aria-label="BitChat geohash channel"
          className="min-w-0 flex-1 border border-border bg-background px-1 py-0.5" />
        <button onClick={() => join(draftGh)} className="border border-border px-1 hover:border-signal hover:text-signal">JOIN</button>
        <button onClick={locate} className="border border-border px-1 hover:border-signal hover:text-signal">📍 NEAR ME</button>
      </div>
      {gh ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-signal">#{gh} · BITCHAT LOCATION CHANNEL</span>
            <span role="status" aria-label="Relay connections"
              className={online === 0 ? "text-destructive" : online < relays.length ? "text-bitcoin" : "text-signal"}>
              {online === 0 ? "○ CONNECTING…" : `● ${online}/${relays.length} RELAYS CONNECTED`}
            </span>
          </div>
          <div ref={list} className="max-h-48 min-h-16 overflow-y-auto">
            {lines.length === 0 ? <p className="text-muted-foreground">No messages in the last hour.</p> : lines.map((l) => {
              const s = status[l.id];
              const e = signed.current.get(l.id);
              return (
                <p key={l.id}>
                  <span className="text-muted-foreground">{time(l.at)} </span>
                  <span className={l.mine ? "text-signal" : "text-bitcoin"}>&lt;{l.nick}&gt;</span> {l.text}
                  {s && <StatusTag s={s} onRetry={() => e && void publish(e)} />}
                </p>
              );
            })}
          </div>
          <div className="flex gap-1">
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="nick" aria-label="BitChat nickname"
              className="w-16 border border-border bg-background px-1 py-0.5" />
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} maxLength={500}
              placeholder="Message BitChat users here" aria-label="BitChat message" className="min-w-0 flex-1 border border-border bg-background px-1 py-0.5" />
            <button onClick={send} disabled={preparing} className="border border-bitcoin px-1 text-bitcoin disabled:opacity-50">{preparing ? "SIGNING…" : "SEND"}</button>
          </div>
          <details className="text-muted-foreground">
            <summary className="cursor-pointer">RELAYS ({online}/{relays.length} CONNECTED)</summary>
            {relays.map((r) => (
              <div key={r.url}><span className={r.connected ? "text-signal" : "text-muted-foreground"}>{r.connected ? "●" : "○"}</span> {host(r.url)}</div>
            ))}
          </details>
          <p className="text-muted-foreground">
            ✓ ACCEPTED means a relay took the message, not that anyone has read it. Messages are public and short-lived; BitChat phones see them in #{gh}.
          </p>
        </>
      ) : <p className="text-muted-foreground">Join a geohash channel to talk with BitChat users in that area.</p>}
      {err && <p className="text-destructive">{err}</p>}
    </div>
  );
}
