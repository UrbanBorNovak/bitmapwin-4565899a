import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Event } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";
import { hasExtension, localPubkey, postDispatch, subscribeCoordinate, RELAYS } from "@/lib/nostr/coordinate";

const MUTE_KEY = "bitmap.nostr.muted";

export function TerritoryDispatches({ height }: { height: number }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ext, setExt] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);

  useEffect(() => {
    setExt(hasExtension());
    setMuted(JSON.parse(localStorage.getItem(MUTE_KEY) ?? "[]"));
    setEvents([]);
    return subscribeCoordinate(height, (e) =>
      setEvents((prev) => (prev.some((p) => p.id === e.id) ? prev : [...prev, e].sort((a, b) => b.created_at - a.created_at).slice(0, 100))),
    );
  }, [height]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await postDispatch(height, text.slice(0, 500), ext);
      setEvents((prev) => [r.event, ...prev.filter((p) => p.id !== r.event.id)]);
      setText("");
      toast("DISPATCH BROADCAST", { description: `ACCEPTED BY ${r.relays} RELAY(S)` });
    } catch (e) {
      toast("BROADCAST FAILED", { description: (e as Error).message.toUpperCase() });
    } finally {
      setBusy(false);
    }
  }

  function mute(pk: string) {
    const next = [...muted, pk];
    setMuted(next);
    localStorage.setItem(MUTE_KEY, JSON.stringify(next));
  }

  const shown = events.filter((e) => !muted.includes(e.pubkey));

  return (
    <section className="mt-6 border border-border">
      <header className="border-b border-border p-5">
        <h2 className="display text-xl">TERRITORY DISPATCHES</h2>
        <p className="label mt-2">
          LIVE NOSTR FEED FOR {height}.BITMAP · {RELAYS.length} PUBLIC RELAYS · NO BITMAPWIN SERVER
        </p>
      </header>
      <div className="border-b border-border p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="LEAVE A DISPATCH ON THIS BITMAP…"
          className="w-full border border-border bg-background p-3 font-mono text-[12px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {ext ? "> SIGNS WITH YOUR NOSTR EXTENSION" : "> NO NOSTR EXTENSION — SIGNS WITH A KEY KEPT ON THIS DEVICE"}
          </span>
          <button className="btn-term !px-3 !py-1.5" disabled={busy || !text.trim()} onClick={send}>
            {busy ? "[ BROADCASTING… ]" : "[ BROADCAST ]"}
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="p-5 font-mono text-[11px] text-muted-foreground">
          &gt; LISTENING ON {height}.BITMAP — NO DISPATCHES YET<span className="blink">_</span>
        </p>
      ) : (
        <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
          {shown.map((e) => {
            const npub = nip19.npubEncode(e.pubkey);
            const mine = !ext && typeof window !== "undefined" && e.pubkey === localPubkey();
            return (
              <li key={e.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                  <a href={`https://njump.me/${npub}`} target="_blank" rel="noreferrer" className="text-signal hover:underline">
                    {npub.slice(0, 12)}…{npub.slice(-4)}{mine ? " · YOU" : ""}
                  </a>
                  <span>
                    {new Date(e.created_at * 1000).toLocaleString()} ·{" "}
                    <button className="hover:text-foreground" onClick={() => mute(e.pubkey)}>MUTE</button>
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">{e.content}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
