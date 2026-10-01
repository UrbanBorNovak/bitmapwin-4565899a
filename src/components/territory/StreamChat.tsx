// Live chat beside a BITMAP's stream. Messages are Nostr notes sent from the
// viewer's browser to public relays; nothing is stored on our server.
import { useEffect, useRef, useState } from "react";
import type { Event } from "nostr-tools/pure";
import { Button } from "@/components/ui/button";
import { hasExtension, localPubkey, postStreamChat, subscribeStreamChat } from "@/lib/nostr/coordinate";

const short = (pk: string) => `${pk.slice(0, 6)}…${pk.slice(-4)}`;
const time = (s: number) => new Date(s * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function StreamChat({ height }: { height: number }) {
  const [messages, setMessages] = useState<Event[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [ext, setExt] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMe(localPubkey());
    setExt(hasExtension());
    setMessages([]);
    const seen = new Set<string>();
    return subscribeStreamChat(height, (e) => {
      if (seen.has(e.id)) return;
      seen.add(e.id);
      setMessages((m) => [...m, e].sort((a, b) => a.created_at - b.created_at).slice(-150));
    });
  }, [height]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const e = await postStreamChat(height, text, ext);
      setText("");
      setMessages((m) => (m.some((x) => x.id === e.id) ? m : [...m, e]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "MESSAGE NOT SENT");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex flex-col border border-border bg-card" aria-labelledby={`stream-chat-${height}`}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id={`stream-chat-${height}`} className="label text-signal">● LIVE CHAT</h2>
        <span className="font-mono text-[10px] text-muted-foreground" data-no-translate>#bitmap-stream:{height}</span>
      </header>
      <div ref={list} className="h-72 space-y-2 overflow-y-auto px-4 py-3 font-mono text-[12px]" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">&gt; No messages in the last 6 hours. Say hello.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="leading-snug">
              <span className="text-muted-foreground">{time(m.created_at)} </span>
              <span className={m.pubkey === me ? "text-bitcoin" : "text-signal"} data-no-translate>{short(m.pubkey)}</span>
              <span className="text-foreground"> {m.content}</span>
            </div>
          ))
        )}
      </div>
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => { e.preventDefault(); void send(); }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          placeholder="Say something about the stream…"
          aria-label="Chat message"
          className="min-w-0 flex-1 border border-border bg-background px-3 py-2 font-mono text-[12px] text-foreground outline-none focus:border-signal"
        />
        <Button type="submit" size="sm" disabled={sending || !text.trim()}>{sending ? "…" : "SEND"}</Button>
      </form>
      <p className="px-4 pb-3 font-mono text-[10px] text-muted-foreground">
        {error ? <span className="text-destructive">{error} · </span> : null}
        {ext ? "Signed with your Nostr extension." : "Signed with a key kept in this browser."} Public on Nostr relays.
      </p>
    </section>
  );
}
