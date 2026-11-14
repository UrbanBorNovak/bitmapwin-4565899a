import { useEffect, useRef, useState } from "react";
import { encodeGeohash, isGeohash, postBitchat, subscribeBitchat, type BitchatLine } from "@/lib/nostr/bitchat-bridge";

const GH_KEY = "bitmap.bitchat.geohash";
const NICK_KEY = "bitmap.bitchat.nick";
const time = (s: number) => new Date(s * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

/** Live BitChat #geohash channel: same room BitChat phone users see. */
export function BitchatChannel() {
  const [gh, setGh] = useState("");
  const [draftGh, setDraftGh] = useState("");
  const [nick, setNick] = useState("");
  const [lines, setLines] = useState<BitchatLine[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const g = localStorage.getItem(GH_KEY) ?? "";
    setGh(g); setDraftGh(g); setNick(localStorage.getItem(NICK_KEY) ?? "");
  }, []);
  useEffect(() => {
    if (!gh) return;
    setLines([]);
    const seen = new Set<string>();
    return subscribeBitchat(gh, (l) => {
      if (seen.has(l.id)) return; seen.add(l.id);
      setLines((m) => [...m, l].sort((a, b) => a.at - b.at).slice(-120));
    });
  }, [gh]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [lines.length]);

  const join = (g: string) => {
    const v = g.trim().toLowerCase();
    if (!isGeohash(v)) { setErr("GEOHASH MUST BE 2–7 CHARACTERS"); return; }
    setErr(null); setGh(v); setDraftGh(v); localStorage.setItem(GH_KEY, v);
  };
  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => join(encodeGeohash(p.coords.latitude, p.coords.longitude, 5)),
    () => setErr("LOCATION NOT SHARED"),
  );
  const send = async () => {
    if (!text.trim()) return;
    try {
      localStorage.setItem(NICK_KEY, nick);
      const l = await postBitchat(gh, nick, text);
      setText("");
      setLines((m) => (m.some((x) => x.id === l.id) ? m : [...m, l]));
    } catch (e) { setErr(e instanceof Error ? e.message : "NOT SENT"); }
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
          <div className="text-signal">#{gh} · BITCHAT LOCATION CHANNEL · VIA NOSTR</div>
          <div ref={list} className="max-h-48 min-h-16 overflow-y-auto">
            {lines.length === 0 ? <p className="text-muted-foreground">No messages in the last hour.</p> : lines.map((l) => (
              <p key={l.id}><span className="text-muted-foreground">{time(l.at)} </span><span className="text-bitcoin">&lt;{l.nick}&gt;</span> {l.text}</p>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="nick" aria-label="BitChat nickname"
              className="w-16 border border-border bg-background px-1 py-0.5" />
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} maxLength={500}
              placeholder="Message BitChat users here" aria-label="BitChat message" className="min-w-0 flex-1 border border-border bg-background px-1 py-0.5" />
            <button onClick={send} className="border border-bitcoin px-1 text-bitcoin">SEND</button>
          </div>
          <p className="text-muted-foreground">Messages are public and short-lived. Phones with the BitChat app see them in #{gh}.</p>
        </>
      ) : <p className="text-muted-foreground">Join a geohash channel to talk with BitChat users in that area.</p>}
      {err && <p className="text-destructive">{err}</p>}
    </div>
  );
}
