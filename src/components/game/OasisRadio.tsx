import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useStandingLand } from "@/lib/land-biome-live";
import { bitmapRoomPubkey, bitmapRoomRelayStatus, postBitmapRoom, subscribeBitmapRoom, type BitchatLine } from "@/lib/nostr/bitchat-bridge";
import { checkFresh, loadRoomProof, parcelBadgeLabel } from "@/lib/nostr/bitchat-landowner";
import { verifyRoomOwnersFn, type RoomOwnerCheck } from "@/lib/nostr/bitchat-landowner.functions";

/** Settle time before re-tuning, so crossing a corner doesn't thrash relay subscriptions. */
export const RADIO_TUNE_MS = 1200;

/**
 * DISTRICT RADIO — the BW-ROOMS-1 room of the BITMAP the avatar stands on.
 * Badges show only for fresh verified checks (signature + live holder); anything else stays plain.
 */
export function OasisRadio() {
  const standing = useStandingLand().height;
  const [height, setHeight] = useState(standing);
  const [lines, setLines] = useState<BitchatLine[]>([]);
  const [owners, setOwners] = useState<Record<string, RoomOwnerCheck>>({});
  const [text, setText] = useState("");
  const [nick, setNick] = useState("");
  const [status, setStatus] = useState("");
  const [relays, setRelays] = useState(0);
  const verify = useServerFn(verifyRoomOwnersFn);
  const asked = useRef(new Set<string>());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => setHeight(standing), RADIO_TUNE_MS); return () => clearTimeout(t); }, [standing]);

  useEffect(() => {
    setLines([]); setOwners({}); asked.current.clear(); setStatus(`TUNING TO #${height}…`);
    const stop = subscribeBitmapRoom(height, (l) => setLines((p) => (p.some((x) => x.id === l.id) ? p : [...p, l].sort((a, b) => a.at - b.at).slice(-120))));
    const t = setInterval(() => setRelays(bitmapRoomRelayStatus().filter((r) => r.connected).length), 2000);
    const clear = setTimeout(() => setStatus(""), 2500);
    return () => { stop(); clearInterval(t); clearTimeout(clear); };
  }, [height]);

  const check = useCallback(() => {
    const due = lines.filter((l) => l.proof && !asked.current.has(l.pubkey)).slice(0, 20);
    if (!due.length) return;
    due.forEach((l) => asked.current.add(l.pubkey));
    const h = height;
    verify({ data: { height: h, items: due.map((l) => ({ pubkey: l.pubkey, ...l.proof! })) } })
      .then((r) => setOwners((p) => ({ ...p, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, checkedAt: Date.now() }])) })))
      .catch(() => due.forEach((l) => asked.current.delete(l.pubkey)));
  }, [lines, height, verify]);
  useEffect(() => { check(); }, [check]);
  useEffect(() => { listRef.current?.scrollTo({ top: 1e9 }); }, [lines]);

  const send = async () => {
    const body = text.trim(); if (!body) return;
    setStatus("SIGNING · PROOF OF WORK…");
    try {
      const proof = loadRoomProof(height, bitmapRoomPubkey(height));
      const r = await postBitmapRoom(height, nick.trim() || "visitor", body, proof);
      setText("");
      setStatus(r.accepted.length ? `SENT · ${r.accepted.length}/${r.of} RELAYS` : "✕ NO RELAY ACCEPTED");
    } catch { setStatus("✕ SEND FAILED"); }
  };

  const badge = (l: BitchatLine) => {
    const c = owners[l.pubkey];
    if (!c?.ok || c.status !== "verified" || !checkFresh(c.checkedAt, Date.now())) return null;
    return c.role === "parcel"
      ? <span className="mr-1 text-signal">▦ PARCEL · {parcelBadgeLabel(c.parcels ?? [], height)}</span>
      : <span className="mr-1 text-bitcoin">👑 LANDOWNER</span>;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col font-mono text-[11px]">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5 text-[10px] tracking-[0.15em]" data-no-translate>
        <span className="text-signal">📻 #{height.toLocaleString("en-US")}.BITMAP</span>
        <span className="text-muted-foreground">{relays}/5 RELAYS</span>
      </div>
      <div ref={listRef} className="min-h-24 max-h-72 flex-1 space-y-1 overflow-y-auto p-2">
        {lines.length === 0 ? <p className="text-muted-foreground">Quiet on this land. Walk to another BITMAP to tune in, or say hello.</p> : lines.map((l) => (
          <p key={l.id} className="break-words"><span data-no-translate>{badge(l)}<span className="text-muted-foreground">{l.nick}:</span></span> {l.text}</p>
        ))}
      </div>
      {status ? <p className="px-2 text-[10px] text-muted-foreground">{status}</p> : null}
      <div className="flex gap-1 border-t border-border p-1.5">
        <input value={nick} onChange={(e) => setNick(e.target.value.slice(0, 20))} placeholder="name" aria-label="Nickname" className="w-16 border border-border bg-background px-1.5 py-1" />
        <input value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} placeholder={`Say something on #${height}`} aria-label="Message" className="min-w-0 flex-1 border border-border bg-background px-1.5 py-1" />
        <button onClick={() => void send()} className="border border-signal px-2 text-signal hover:bg-signal/10">SEND</button>
      </div>
      <Link to="/bitchat" className="px-2 pb-1.5 text-[10px] text-muted-foreground hover:text-bitcoin">Own this land? Prove it once on BITMAP Rooms to wear your badge here →</Link>
    </div>
  );
}
