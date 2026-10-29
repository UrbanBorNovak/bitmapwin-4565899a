import { useEffect, useState } from "react";
import type { Event } from "nostr-tools/pure";
import type { ToonEpisode } from "@/lib/toon-script";
import { readPacket } from "@/lib/toon-ai-packet";
import { fetchEpisode, hasNostrExtension, naddrOf, publishEpisode, recentEpisodes, titleOf } from "@/lib/nostr/toon-episodes";

/** Publish the current episode to Nostr relays and browse/play community episodes. */
export function NostrEpisodesPanel({ episode, onOpen }: { episode: ToonEpisode; onOpen: (e: ToonEpisode) => void }) {
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<Event[] | null>(null);
  const [useExt, setUseExt] = useState(false);

  const open = (e: Event) => {
    const r = readPacket(e.content);
    if ("errors" in r) return setMsg(`THIS EPISODE DID NOT PASS THE CHECK: ${r.errors[0]}`);
    if (window.confirm(`Open "${titleOf(e)}"? Your current episode will be replaced.`)) { onOpen(r.episode); setMsg(`OPENED "${titleOf(e)}"`); }
  };

  useEffect(() => {
    setUseExt(hasNostrExtension());
    const ep = new URLSearchParams(window.location.search).get("ep");
    if (!ep?.startsWith("naddr1")) return;
    setMsg("FETCHING SHARED EPISODE…");
    fetchEpisode(ep).then((e) => (e ? open(e) : setMsg("SHARED EPISODE NOT FOUND ON RELAYS"))).catch((x) => setMsg(String(x.message ?? x)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await publishEpisode(JSON.stringify(episode), episode.title, episode.aspect, useExt);
      const url = `${window.location.origin}/toon?ep=${r.naddr}`;
      setLink(url); setMsg(`PUBLISHED TO ${r.relays} RELAYS`);
    } catch (x) { setMsg(x instanceof Error ? x.message : "PUBLISH FAILED"); } finally { setBusy(false); }
  };

  const browse = async () => {
    setBusy(true); setMsg("");
    try { setFeed(await recentEpisodes()); } catch { setMsg("RELAYS DID NOT ANSWER"); } finally { setBusy(false); }
  };

  return (
    <section className="rounded border border-border p-3 font-mono text-xs">
      <div className="label text-signal">NOSTR · PUBLISH & SHARE</div>
      <p className="mt-1 text-[11px] text-muted-foreground">Posts the episode script to public Nostr relays. Anyone with the link can play it here — no account, nothing stored on our side.</p>
      <label className="mt-2 flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={useExt} disabled={!hasNostrExtension()} onChange={(e) => setUseExt(e.target.checked)} />
        {hasNostrExtension() ? "Sign with my Nostr extension" : "No Nostr extension found — a key on this device will sign"}
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-term" disabled={busy} onClick={() => void publish()}>[ ⚡ PUBLISH EPISODE ]</button>
        <button className="btn-term-ghost" disabled={busy} onClick={() => void browse()}>[ BROWSE COMMUNITY ]</button>
      </div>
      {msg && <p className="mt-2 text-[11px] text-signal">{msg}</p>}
      {link && (
        <div className="mt-2 flex gap-2">
          <input readOnly value={link} className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[10px]" onFocus={(e) => e.target.select()} />
          <button className="btn-term-ghost" onClick={() => void navigator.clipboard.writeText(link)}>COPY</button>
        </div>
      )}
      {feed && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
          {feed.length === 0 && <li className="text-muted-foreground">No community episodes yet.</li>}
          {feed.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
              <span className="truncate">{titleOf(e)} <span className="text-muted-foreground">· {new Date(e.created_at * 1000).toLocaleDateString()}</span></span>
              <span className="flex shrink-0 gap-1">
                <button className="btn-term-ghost" onClick={() => open(e)}>PLAY</button>
                <button className="btn-term-ghost" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/toon?ep=${naddrOf(e)}`)}>LINK</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
