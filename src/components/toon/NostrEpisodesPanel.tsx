import { useEffect, useState } from "react";
import type { Event } from "nostr-tools/pure";
import type { ToonEpisode } from "@/lib/toon-script";
import { readPacket } from "@/lib/toon-ai-packet";
import { exportNsec, importNsec, myNpub, fetchEpisode, hasNostrExtension, naddrOf, publishEpisode, recentEpisodes, titleOf } from "@/lib/nostr/toon-episodes";

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

  const [npub, setNpub] = useState("");
  const [nsec, setNsec] = useState("");
  const [restore, setRestore] = useState("");
  useEffect(() => { setNpub(myNpub()); }, []);
  const doRestore = () => {
    if (!window.confirm("Replace this device's Nostr key? Episodes signed by the current key stay under the old identity — back it up first.")) return;
    try { setNpub(importNsec(restore)); setRestore(""); setNsec(""); setMsg("IDENTITY RESTORED"); } catch (x) { setMsg(x instanceof Error ? x.message : "RESTORE FAILED"); }
  };

  const publish = async () => {
    if (!window.confirm(`Publish "${episode.title}" to public Nostr relays?\n\nAnyone can read and copy it. Updates replace it, but relays may keep copies forever, and we cannot delete it. Relays may also drop it at any time — keep your own copy.`)) return;
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
      <p className="mt-1 rounded border border-primary/40 p-2 text-[11px] text-primary">PUBLIC: published episodes can be read by anyone and may never be fully deleted. Relays are run by others and may drop episodes at any time — keep your own export.</p>
      <label className="mt-2 flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={useExt} disabled={!hasNostrExtension()} onChange={(e) => setUseExt(e.target.checked)} />
        {hasNostrExtension() ? "Sign with my Nostr extension" : "No Nostr extension found — a key on this device will sign"}
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-term" disabled={busy} onClick={() => void publish()}>[ ⚡ PUBLISH EPISODE ]</button>
        <button className="btn-term-ghost" disabled={busy} onClick={() => void browse()}>[ BROWSE COMMUNITY ]</button>
      </div>
      {!useExt && (
        <details className="mt-2 rounded border border-border p-2 text-[11px]">
          <summary className="cursor-pointer text-signal">DEVICE IDENTITY · BACKUP & RECOVERY</summary>
          <p className="mt-1 break-all text-muted-foreground">Public ID: {npub}</p>
          <p className="mt-1 text-muted-foreground">This key lives only in this browser. Clearing site data or switching devices loses it, and you can no longer update your episodes. Back it up somewhere safe — anyone with it can post as you.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-term-ghost" onClick={() => { if (window.confirm("Show your secret key? Never share it with anyone.")) setNsec(exportNsec()); }}>REVEAL SECRET KEY</button>
            {nsec && <button className="btn-term-ghost" onClick={() => void navigator.clipboard.writeText(nsec)}>COPY</button>}
            {nsec && <button className="btn-term-ghost" onClick={() => setNsec("")}>HIDE</button>}
          </div>
          {nsec && <p className="mt-1 break-all text-primary">{nsec}</p>}
          <div className="mt-2 flex gap-2">
            <input value={restore} onChange={(e) => setRestore(e.target.value)} placeholder="nsec1… to restore" className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1" />
            <button className="btn-term-ghost" disabled={!restore.trim()} onClick={doRestore}>RESTORE</button>
          </div>
        </details>
      )}
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
