import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/auth";
import { useChainTip } from "@/lib/use-chain-tip";
import { episodeLength, sceneAt } from "@/lib/toon-script";
import { playSoundtrack, renderSoundtrack } from "@/lib/toon-audio";
import { impact, speakRadio, stopAllVoice, whoosh } from "@/lib/chapter-voice";
import { styleFilter } from "@/lib/toon-style";
import { CHAPTER_SETS, QUOTE_MAX, TITLE_MAX, autoSet, chapterEpisode, chapterTheme, defaultQuote, defaultTitle, type ChapterSet } from "@/lib/biternam-chapter";
import { supabase } from "@/integrations/supabase/client";
import { CAMERA_PRESETS, pickCoStars, type CameraPreset } from "@/lib/biternam-cast";
import { fromQuery, lookup, statusLabel } from "@/lib/chapter-cast";
import { blockFactsFn, listChaptersFn, publishChapterFn } from "@/lib/biternam-chapter.functions";
import { deliverClip, startClipCapture, type ClipSession } from "@/lib/chapter-record";

const ToonStage3D = lazy(() => import("@/components/toon/ToonStage3D"));

export const Route = createFileRoute("/biternam_/chapters")({
  validateSearch: (s: Record<string, unknown>) => ({ block: typeof s["block"] === "number" ? s["block"] : undefined }),
  head: () => ({
    meta: [
      { title: "Chapter Generator · Biternam Community Chronicles | BITMAPWIN" },
      { name: "description", content: "Turn your BITMAP into a free Biternam chapter: a live 3D vignette built from the block's own facts, added to the story." },
      { property: "og:title", content: "Biternam Chapter Generator" },
      { property: "og:description", content: "Pick your block, preview its 3D chapter live, write a title and quote, publish for free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChaptersPage,
});

function ChaptersPage() {
  const search = Route.useSearch();
  const tip = useChainTip();
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const [input, setInput] = useState(String(search.block ?? 840000));
  const [height, setHeight] = useState(search.block ?? 840000);
  const [title, setTitle] = useState("");
  const [quote, setQuote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const facts = useQuery({ queryKey: ["chapter-block-facts", height], queryFn: () => blockFactsFn({ data: { height } }), retry: 1 });
  const guardianQ = useQuery({ queryKey: ["chapter-guardian", height], retry: 1, staleTime: 30_000,
    queryFn: async () => ({ height, l: await lookup(() => supabase.from("bitmon_guardians").select("species").eq("block_height", height).maybeSingle(), (r: { species: string }) => r.species || null) }) });
  const buildQ = useQuery({ queryKey: ["chapter-build", height], retry: 1, staleTime: 60_000,
    queryFn: async () => ({ height, l: await lookup(() => supabase.from("bitmap_forge_builds").select("inscription_id").eq("bitmap_height", height).maybeSingle(), (r: { inscription_id: string }) => r.inscription_id || null) }) });
  const guardian = fromQuery({ ...guardianQ, data: guardianQ.data?.l }, height, guardianQ.data?.height);
  const build = fromQuery({ ...buildQ, data: buildQ.data?.l }, height, buildQ.data?.height);
  const [setPick, setSetPick] = useState<ChapterSet | "auto">("auto");
  const [seed, setSeed] = useState(0);
  const [camera, setCamera] = useState<CameraPreset>("auto");
  const chapters = useQuery({ queryKey: ["biternam-chapters"], queryFn: () => listChaptersFn(), staleTime: 30_000 });
  const f = { height, txCount: facts.data?.txCount ?? null, avgFeeRate: facts.data?.avgFeeRate ?? null, minedAt: facts.data?.minedAt ?? null };
  const existing = chapters.data?.find((c) => c.height === height);


  const species = guardian.state === "found" ? guardian.value : null, hasBuild = build.state === "found";
  const guardianUnknown = guardian.state === "checking" || guardian.state === "unavailable";
  const chosenSet = setPick === "auto" ? autoSet(f) : setPick;
  const sug = { set: chosenSet, seed, guardian: species ? { species } : null };
  useEffect(() => { setTitle(existing?.title ?? defaultTitle(f, sug)); setQuote(existing?.quote ?? defaultQuote(f, sug)); setMsg(null); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [height, facts.data?.txCount, existing?.title, chosenSet, seed, species]);
  const [jokeLang, setJokeLang] = useState<"en" | "zh">("en");
  const episode = useMemo(() => chapterEpisode(f, title || defaultTitle(f, sug), quote || defaultQuote(f, sug), { guardian: species ? { species } : null, hasBuild, set: chosenSet, guardianUnknown, seed, camera, lang: jokeLang }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [height, f.txCount, f.avgFeeRate, f.minedAt, title, quote, species, hasBuild, chosenSet, guardianUnknown, seed, camera, jokeLang]);
  const INTRO = 3, OUTRO = 4;
  const body = episodeLength(episode), total = INTRO + body + OUTRO;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const t0 = useRef(0);
  useEffect(() => { setTime(0); setPlaying(false); }, [height]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0; const start = performance.now(), base = t0.current;
    const tick = (now: number) => { const t = base + (now - start) / 1000; if (t >= total) { setTime(total); setPlaying(false); return; } setTime(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);
  const [muted, setMuted] = useState(false);
  const sound = useRef<{ ep: unknown; buf: Promise<AudioBuffer | null> } | null>(null);
  useEffect(() => {
    if (!playing || muted) return;
    if (sound.current?.ep !== episode) sound.current = { ep: episode, buf: renderSoundtrack(episode).catch(() => null) };
    let stop: (() => void) | null = null, live = true;
    const startedAt = performance.now(), base = t0.current;
    void sound.current.buf.then((b) => { if (live && b) stop = playSoundtrack(b, base + (performance.now() - startedAt) / 1000); });
    return () => { live = false; stop?.(); };
  }, [playing, muted, episode]);
  // Story time excludes the opening title card; it is frozen during the cards.
  const inBody = time >= INTRO && time < INTRO + body;
  const bodyT = Math.min(Math.max(time - INTRO, 0), Math.max(0, body - 0.001));
  const POP = 1.6; // seconds into the ending card when ".bitmap" pops in
  const at = sceneAt(episode, bodyT);
  const scene = episode.scenes[at.index];
  const line = inBody ? scene?.lines.find((l) => at.local >= l.at && at.local < l.at + l.dur) : undefined;
  const speaker = line ? scene?.cast[line.speaker]?.name : undefined;
  // Radio-voice dialogue + camera foley, fired once per line / cut.
  const lineKey = playing && line ? `${at.index}:${line.at}` : "";
  useEffect(() => {
    if (!lineKey || muted || !line) return;
    // Let the line finish naturally; the next line or a pause cuts it.
    speakRadio(line.text, speaker ?? "narrator", line.dur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey, muted]);
  const outroT = time - INTRO - body;
  const phase = time < INTRO ? -1 : outroT >= POP ? 2e6 : outroT >= 0 ? 1e6 : at.index;
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (!playing || muted) { lastPhase.current = phase; return; }
    if (phase !== lastPhase.current) {
      if (phase === 2e6) impact();
      else { whoosh(); if (phase === 0) impact(0.2); if (phase === 1e6) stopAllVoice(); }
    }
    lastPhase.current = phase;
  }, [phase, playing, muted]);
  useEffect(() => { if (!playing || muted) stopAllVoice(); }, [playing, muted]);
  useEffect(() => () => stopAllVoice(), []);

  const playerRef = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState(false);
  const session = useRef<ClipSession | null>(null);
  const [recState, setRecState] = useState<"idle" | "recording">("idle");
  const [recMsg, setRecMsg] = useState("");
  const [clip, setClip] = useState<{ blob: Blob; name: string } | null>(null);
  const record = async () => {
    if (!playerRef.current) return;
    setClip(null); setRecMsg("Choose THIS TAB and turn on tab audio in the share dialog.");
    try {
      const s = await startClipCapture(playerRef.current);
      session.current = s; setRecState("recording"); setRecMsg("Recording the full chapter…");
      s.onEnded(() => { s.cancel(); session.current = null; setRecState("idle"); setPlaying(false); setRecMsg("Recording stopped."); });
      await new Promise((r) => setTimeout(r, 400));
      t0.current = 0; setTime(0); setPlaying(true);
    } catch (e) { setRecState("idle"); setRecMsg((e as Error).name === "NotAllowedError" ? "Recording cancelled." : (e as Error).message); }
  };
  useEffect(() => {
    const s = session.current;
    if (!s || playing || recState !== "recording" || time < total) return;
    session.current = null;
    void (async () => { await new Promise((r) => setTimeout(r, 500)); const blob = await s.stop(); setRecState("idle");
      setClip({ blob, name: `${height}.bitmap-chapter${portrait ? "-9x16" : ""}.${s.ext}` }); setRecMsg("Clip ready. Download and share it."); })();
  }, [playing, time, total, recState, height, portrait]);
  useEffect(() => () => session.current?.cancel(), []);

  const beyondTip = tip > 0 && height > tip;
  const choose = () => {
    const n = Number(input.replace(/[^0-9]/g, ""));
    if (Number.isInteger(n) && n >= 0) setHeight(n);
  };
  const publish = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await publishChapterFn({ data: { height, title, quote } });
      setMsg(r.ok ? { ok: true, text: "PUBLISHED · YOUR CHAPTER IS NOW IN THE STORY" } : { ok: false, text: r.reason ?? "NOT PUBLISHED" });
      if (r.ok) await qc.invalidateQueries({ queryKey: ["biternam-chapters"] });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <div className="label text-bitcoin">BITERNAM · COMMUNITY CHRONICLES</div>
      <h1 className="display mt-2 text-2xl md:text-4xl">CHAPTER GENERATOR</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Pick your BITMAP. Its scene, cast and music come from the block itself. Write a title and a quote, preview it, and publish for free. Only the live holder can publish.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div ref={playerRef} className={`relative overflow-hidden rounded-lg border border-border bg-card ${portrait ? "mx-auto aspect-[9/16] h-[min(78vh,900px)]" : "aspect-video"}`} style={{ containerType: "inline-size" }}>
            <div className="vhs-tape absolute inset-0" style={{ filter: `${styleFilter(episode.style)} saturate(1.25) contrast(1.08) sepia(0.12)` }}>
              <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING SCENE…</div>}>
                <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING SCENE…</div>}>
                  <ToonStage3D episode={episode} time={bodyT} />
                </Suspense>
              </ClientOnly>
            </div>
            <div aria-hidden className="cine-dof pointer-events-none absolute inset-0" />
            <div aria-hidden className="cine-grain pointer-events-none absolute inset-0" />
            <div aria-hidden className="vhs-scan pointer-events-none absolute inset-0" />
            <div aria-hidden className="pointer-events-none absolute inset-0 p-3 font-mono text-sm tracking-widest text-foreground [text-shadow:2px_0_hsl(0_90%_55%/.7),-2px_0_hsl(190_90%_55%/.7)]" data-no-translate>
              <div className="flex justify-between"><span>{playing ? "▶ PLAY" : "❚❚ PAUSE"}</span><span>SP</span></div>
              {playing && <div className="mt-1 text-destructive animate-pulse">● REC</div>}
              <div className="absolute right-3 top-9 text-right">
                <div>{`00:${String(Math.floor(time / 60)).padStart(2, "0")}:${String(Math.floor(time % 60)).padStart(2, "0")}`}</div>
                <div>{["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][height % 12]} {String(1 + (height % 28)).padStart(2, "0")} 199{height % 10}</div>
              </div>
            </div>
            {phase >= 0 && phase < 1e6 && playing && (
              <div key={`fx${phase}`} aria-hidden className="pointer-events-none absolute inset-0" data-no-translate>
                <div className="manga-speed absolute inset-0" />
                <div className="manga-sfx absolute bottom-[10%] left-[5%] display text-bitcoin" style={{ rotate: `${(phase % 2 ? 1 : -1) * 10}deg`, fontSize: "min(7cqw, 3.5rem)" }}>
                  {["KA-CHING!", "WHOOSH!", "BLAM!", "ZAP!", "KRAK!", "VROOM!", "POW!", "HODL!"][(height + phase) % 8]}
                </div>
              </div>
            )}
            {line && (
              <div key={lineKey} className={`comic-bubble pointer-events-none absolute w-fit px-3 py-1.5 text-center ${portrait ? "top-[9%] max-w-[78%]" : "top-[15%] max-w-[36%]"}`} style={{ [line.speaker % 2 ? "right" : "left"]: "4%" }} data-no-translate>
                <span className="font-mono text-[9px] tracking-widest">{speaker}</span>
                <div className="display uppercase leading-tight" style={{ fontSize: portrait ? "min(7cqw, 1.6rem)" : "min(3.2cqw, 1.6rem)" }}>{line.text}</div>
              </div>
            )}
            {time < INTRO && (playing || time > 0) && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background text-center" data-no-translate>
                <div>
                  <div className="font-mono text-xs tracking-[0.4em] text-signal">CHAPTER</div>
                  <div className="display mt-2 text-bitcoin" style={{ fontSize: portrait ? "16cqw" : "min(8cqw, 3.75rem)" }}>{height.toLocaleString("en-US")}</div>
                  <div className="display mt-3 px-4" style={{ fontSize: portrait ? "7cqw" : "min(3cqw, 1.5rem)" }}>{episode.title}</div>
                </div>
              </div>
            )}
            {outroT >= 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background px-4 text-center" data-no-translate>
                <div className="max-w-full">
                  <div className="font-mono tracking-[0.25em] text-muted-foreground" style={{ fontSize: portrait ? "3.4cqw" : "min(1.6cqw, 0.75rem)" }}>IT WAS NEVER A GAME. IT WAS ALWAYS</div>
                  <div className="display mt-3 whitespace-nowrap normal-case" style={{ fontSize: "min(8.5cqw, 4.5rem)" }}>
                    {height}<span className={`text-bitcoin transition-all duration-300 ${outroT >= POP ? "opacity-100" : "opacity-0"}`} style={{ display: "inline-block", transform: outroT >= POP ? "scale(1)" : "scale(1.8)" }}>.bitmap</span>
                  </div>
                  <div className={`mt-4 font-mono text-xs tracking-[0.4em] text-signal transition-opacity duration-500 ${outroT >= POP + 1 ? "opacity-100" : "opacity-0"}`}>THE END</div>
                </div>
              </div>
            )}
            {outroT >= POP && <div aria-hidden className="manga-halftone pointer-events-none absolute inset-0" />}
            {!playing && time >= total ? (
              <button aria-label="Preview chapter" onClick={() => { t0.current = 0; setPlaying(true); }}
                className="absolute bottom-3 right-3 rounded border border-bitcoin bg-background/80 px-3 py-1 font-mono text-xs text-bitcoin hover:bg-bitcoin/10">↻ REPLAY</button>
            ) : !playing && (
              <button aria-label="Preview chapter" onClick={() => { t0.current = time >= total ? 0 : time; setPlaying(true); }}
                className="absolute inset-0 grid place-items-center bg-background/30 hover:bg-background/10">
                <span className="grid size-20 place-items-center rounded-full border border-bitcoin bg-background/70 font-display text-3xl text-bitcoin">▶</span>
              </button>
            )}
          </div>
          <button onClick={() => setMuted((m) => !m)} aria-pressed={!muted} className="mt-2 mr-3 rounded border border-signal px-2 py-0.5 font-mono text-[11px] text-signal hover:bg-signal/10">{muted ? "[ SOUND OFF ]" : "[ SOUND ON ]"}</button>
          <button onClick={() => setJokeLang((l) => (l === "en" ? "zh" : "en"))} disabled={recState === "recording"} aria-label="Joke language" aria-pressed={jokeLang === "zh"} data-no-translate className="mt-2 mr-3 rounded border border-signal px-2 py-0.5 font-mono text-[11px] text-signal hover:bg-signal/10 disabled:opacity-50">{jokeLang === "zh" ? "[ JOKES · 中文 ]" : "[ JOKES · EN ]"}</button>
          <button onClick={() => setPortrait((v) => !v)} disabled={recState === "recording"} aria-pressed={portrait} className="mt-2 mr-3 rounded border border-signal px-2 py-0.5 font-mono text-[11px] text-signal hover:bg-signal/10 disabled:opacity-50">{portrait ? "[ ▯ 9:16 PORTRAIT ]" : "[ ▭ 16:9 WIDE ]"}</button>
          <button onClick={() => void record()} disabled={recState === "recording"} className="mt-2 mr-3 rounded border border-bitcoin px-2 py-0.5 font-mono text-[11px] text-bitcoin hover:bg-bitcoin/10 disabled:opacity-50">{recState === "recording" ? "● RECORDING…" : "[ ● RECORD CLIP ]"}</button>
          {clip && <button onClick={() => void deliverClip(clip.blob, clip.name)} className="mt-2 mr-3 rounded border border-primary bg-primary px-2 py-0.5 font-mono text-[11px] text-primary-foreground">⬇ DOWNLOAD {clip.name.split(".").pop()?.toUpperCase()} · {(clip.blob.size / 1e6).toFixed(1)} MB</button>}
          {recMsg && <div className="mt-1 font-mono text-[11px] text-muted-foreground">{recMsg}</div>}
          <div className="mt-2 inline font-mono text-[11px] text-muted-foreground">{episode.title} · {Math.round(total)}s · rendered live in your browser</div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-4 font-mono text-xs">
          <div>
            <label htmlFor="blk" className="text-muted-foreground">BLOCK HEIGHT</label>
            <div className="mt-1 flex gap-2">
              <input id="blk" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && choose()} className="w-full rounded border border-border bg-background px-2 py-1.5" />
              <button onClick={choose} className="rounded border border-primary px-3 text-primary hover:bg-primary hover:text-primary-foreground">LOAD</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-muted-foreground">BITMAP</span><span data-no-translate>{height}.bitmap</span>
            <span className="text-muted-foreground">THEME</span><span className="text-signal">{chapterTheme(f).toUpperCase()}</span>
            <span className="text-muted-foreground">TRANSACTIONS</span><span>{facts.isPending ? "…" : f.txCount == null ? "UNAVAILABLE" : f.txCount.toLocaleString("en-US")}</span>
            <span className="text-muted-foreground">AVG FEE</span><span>{facts.isPending ? "…" : f.avgFeeRate == null ? "UNAVAILABLE" : `${f.avgFeeRate} sat/vB`}</span>
            <span className="text-muted-foreground">MINED</span><span>{facts.isPending ? "…" : f.minedAt == null ? "UNAVAILABLE" : new Date(f.minedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC"}</span>
            <span className="text-muted-foreground">SOURCE</span><span className={facts.data?.note ? "text-destructive" : ""}>{facts.isError ? "LOOKUP FAILED" : facts.data ? `${(facts.data.source ?? "unavailable").toUpperCase()}${facts.data.note ? ` · ${facts.data.note}` : ""}` : "…"}</span>
            <span className="text-muted-foreground">GUARDIAN</span><span data-testid="guardian-status" className={species ? "text-bitcoin" : guardian.state === "unavailable" ? "text-destructive" : "text-muted-foreground"}>{statusLabel(guardian, `AWAKE · ${species}`, "NONE CONFIRMED · EXPLORER CAST")}</span>
            <span className="text-muted-foreground">BUILD</span><span data-testid="build-status" className={hasBuild ? "text-bitcoin" : build.state === "unavailable" ? "text-destructive" : "text-muted-foreground"}>{statusLabel(build, "INSCRIBED · SHOWN ON LAND", "NONE CONFIRMED · BARE LAND")}</span>
          </div>
          <div>
            <label htmlFor="set" className="text-muted-foreground">BITERNAM SET</label>
            <select id="set" value={setPick} onChange={(e) => setSetPick(e.target.value as ChapterSet | "auto")} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5">
              <option value="auto">AUTO · {CHAPTER_SETS.find((s) => s.v === autoSet(f))!.label}</option>
              {CHAPTER_SETS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cam" className="text-muted-foreground">CAMERAS</label>
            <select id="cam" value={camera} onChange={(e) => setCamera(e.target.value as CameraPreset)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5">
              {CAMERA_PRESETS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-muted-foreground">CO-STARS · THE UNREASONABLES</div>
            <div className="mt-1 text-signal" data-testid="costars">{pickCoStars(height, seed).map((c) => c.name).join(" · ")}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Everyone wears a real BITMAP Pixel. Background extras move by fly brain.</div>
            <button onClick={() => { setSeed((s) => s + 1); setTime(0); setPlaying(false); }} className="mt-2 w-full rounded border border-signal py-1.5 text-signal hover:bg-signal/10">[ ROLL CAST &amp; CAMERAS ]</button>
          </div>
          {beyondTip &&  <div className="text-destructive">UNMINED · BEYOND CHAIN TIP ({tip.toLocaleString("en-US")})</div>}
          <div>
            <label htmlFor="ttl" className="text-muted-foreground">TITLE ({title.length}/{TITLE_MAX})</label>
            <input id="ttl" maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5" />
          </div>
          <div>
            <label htmlFor="qt" className="text-muted-foreground">QUOTE ({quote.length}/{QUOTE_MAX})</label>
            <textarea id="qt" maxLength={QUOTE_MAX} rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5" />
          </div>
          {existing && <div className="text-muted-foreground">A chapter is already published for this BITMAP. Publishing again replaces it.</div>}
          {user ? (
            <button disabled={busy || beyondTip} onClick={publish} className="w-full rounded border border-primary py-2 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40">
              {busy ? "CHECKING HOLDER ON BITCOIN…" : "[ PUBLISH FREE ]"}
            </button>
          ) : (
            <Link to="/auth" className="block w-full rounded border border-primary py-2 text-center text-primary">[ SIGN IN TO PUBLISH ]</Link>
          )}
          {msg && <div className={msg.ok ? "text-signal" : "text-destructive"}>{msg.text}</div>}
        </div>
      </div>

      <section className="mt-12">
        <div className="label text-bitcoin">PUBLISHED CHAPTERS</div>
        {chapters.data?.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {chapters.data.map((c) => (
              <button key={c.height} onClick={() => { setInput(String(c.height)); setHeight(c.height); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="rounded border border-border bg-card p-3 text-left hover:border-signal">
                <div className="font-mono text-[10px] text-signal" data-no-translate>CH.{c.height}</div>
                <div className="font-display text-lg">{c.title}</div>
                <p className="mt-1 text-sm italic text-muted-foreground">"{c.quote}"</p>
              </button>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-muted-foreground">{chapters.isPending ? "Loading…" : "No community chapters yet. Be the first."}</p>}
      </section>
    </main>
  );
}
