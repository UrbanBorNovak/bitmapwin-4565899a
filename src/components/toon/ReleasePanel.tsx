import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ToonEpisode } from "@/lib/toon-script";
import { useAuthSession } from "@/lib/auth";
import { fetchAccountChannels, saveAccountChannels, youtubeChaptersValid, channelUrl, cleanHandle, loadChannels, releaseDescription, releaseTitle, saveChannels, UPLOAD_URL, type Channels, type Platform } from "@/lib/release-kit";

const TABS: { id: Platform; label: string; aspect: "16:9" | "9:16" }[] = [
  { id: "youtube", label: "YOUTUBE", aspect: "16:9" },
  { id: "shorts", label: "SHORTS", aspect: "9:16" },
  { id: "tiktok", label: "TIKTOK", aspect: "9:16" },
  { id: "x", label: "X", aspect: "16:9" },
];

/** Release pipeline: link channels, copy platform-ready text, share the saved file, open the upload page. */
export function ReleasePanel({ episode, file, onAspect }: { episode: ToonEpisode; file?: File | null; onAspect?: (a: "16:9" | "9:16") => void }) {
  const [tab, setTab] = useState<Platform>("youtube");
  const [ch, setCh] = useState<Channels>({ youtube: "", tiktok: "", x: "" });
  const { user } = useAuthSession();
  const [sync, setSync] = useState<"local" | "loading" | "saved" | "saving" | "error">("local");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setCh(loadChannels()), []);
  useEffect(() => {
    if (!user) { setSync("local"); return; }
    let live = true; setSync("loading");
    fetchAccountChannels(user.id).then(async (acc) => {
      if (!live) return;
      const local = loadChannels();
      if (acc && (acc.youtube || acc.tiktok || acc.x)) { setCh(acc); saveChannels(acc); }
      else if (local.youtube || local.tiktok || local.x) await saveAccountChannels(user.id, local);
      if (live) setSync("saved");
    }).catch(() => live && setSync("error"));
    return () => { live = false; };
  }, [user?.id]);
  const meta = TABS.find((t) => t.id === tab)!;
  const title = releaseTitle(episode, tab);
  const desc = releaseDescription(episode, tab, ch);
  const kind = file ? (file.type.includes("mp4") ? "MP4" : "WEBM") : null;
  const aspectOk = (episode.aspect ?? "16:9") === meta.aspect;

  const copy = async (s: string, what: string) => { await navigator.clipboard.writeText(s); toast(`${what} COPIED`); };
  const setField = (k: keyof Channels, v: string) => { const n = { ...ch, [k]: v }; setCh(n); saveChannels(n);
    if (!user) return;
    setSync("saving"); if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveAccountChannels(user.id, n).then(() => setSync("saved"), () => setSync("error")); }, 700);
  };
  const share = async () => {
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text: desc.slice(0, 500) }); toast("VIDEO HANDED TO YOUR SHARE SHEET"); return; }
      catch (e) { if ((e as Error)?.name === "AbortError") { toast("SHARE CANCELLED"); return; } }
    }
    if (file) toast("THIS BROWSER CAN'T SHARE FILES — UPLOAD THE SAVED FILE ON THE PAGE THAT OPENED");
    window.open(UPLOAD_URL[tab], "_blank", "noopener");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 font-mono text-xs">
      <div className="label text-bitcoin">RELEASE PIPELINE</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t.id} className={tab === t.id ? "btn-term" : "btn-term-ghost"} onClick={() => setTab(t.id)}>[ {t.label} ]</button>)}
      </div>
      <div className="mt-3 text-muted-foreground">
        FORMAT {meta.aspect} · {meta.aspect === "16:9" ? "1280×720" : "720×1280"} MP4 ·{" "}
        {aspectOk ? <span className="text-signal">EPISODE MATCHES</span> : !onAspect ? <span className="text-bitcoin">THIS EPISODE IS {episode.aspect ?? "16:9"}</span> : (
          <button className="text-bitcoin underline" onClick={() => onAspect?.(meta.aspect)}>SWITCH EPISODE TO {meta.aspect}</button>
        )}
      </div>
      <label className="mt-3 block label">TITLE</label>
      <div className="mt-1 flex gap-2"><input readOnly value={title} className="w-full border border-border bg-background px-2 py-1" /><button className="btn-term-ghost" onClick={() => void copy(title, "TITLE")}>[ COPY ]</button></div>
      <label className="mt-3 block label">{tab === "youtube" ? "DESCRIPTION + TIMESTAMPS" : "CAPTION"}</label>
      <textarea readOnly value={desc} rows={tab === "youtube" ? 8 : 4} className="mt-1 w-full border border-border bg-background px-2 py-1" />
      {tab === "youtube" && !youtubeChaptersValid(episode) && <p className="mt-1 text-muted-foreground">YouTube shows chapters only with 3+ scenes of 10 s or more; these stay plain timestamps.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-term-ghost" onClick={() => void copy(desc, "TEXT")}>[ COPY TEXT ]</button>
        <button className="btn-term" onClick={() => void share()}>[ {file ? "SHARE VIDEO / OPEN UPLOAD" : "OPEN UPLOAD PAGE"} ]</button>
      </div>
      {kind === "WEBM" && tab === "x" && <p className="mt-2 text-bitcoin">YOUR FILE IS WEBM — X ONLY ACCEPTS MP4. EXPORT IN CHROME, EDGE OR SAFARI.</p>}
      <p className="mt-2 text-muted-foreground">{file ? `READY: ${file.name} (${kind}). ` : "Export the video first. "}Nothing is posted for you — you choose the file and press post on {tab === "tiktok" ? "TikTok" : tab === "x" ? "X" : "YouTube"} yourself.</p>

      <div className="label mt-4 text-signal">YOUR CHANNELS</div>
      <p className="mt-1 text-muted-foreground" role="status">{
        sync === "local" ? <>Saved on this device only. <a href="/auth" className="text-bitcoin hover:underline">Sign in</a> to keep them on every device.</>
        : sync === "loading" ? "Loading from your account…" : sync === "saving" ? "Saving to your account…"
        : sync === "error" ? <span className="text-destructive">Couldn't reach your account — kept on this device for now.</span>
        : "Saved to your account — available on every device you sign in on."} Added as creator credits.</p>
      {(["youtube", "tiktok", "x"] as const).map((k) => (
        <div key={k} className="mt-2 flex items-center gap-2">
          <span className="w-16">{k.toUpperCase()}</span>
          <input value={ch[k]} onChange={(e) => setField(k, e.target.value)} placeholder="@handle" aria-label={`${k} handle`} className="w-full border border-border bg-background px-2 py-1" />
          {cleanHandle(ch[k]) && <a href={channelUrl(k, ch[k])} target="_blank" rel="noopener noreferrer" className="text-signal hover:underline">OPEN</a>}
        </div>
      ))}
    </section>
  );
}
