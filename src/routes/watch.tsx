import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { episodeLength, generateEpisode, sceneAt, type ToonEpisode } from "@/lib/toon-script";
import { styleFilter } from "@/lib/toon-style";
import { playSoundtrack, renderSoundtrack } from "@/lib/toon-audio";
import { CITADEL_TEASER } from "@/lib/toon-teaser";
import { drawOverlay } from "@/lib/toon-overlay";
import { useQuery } from "@tanstack/react-query";
import { parseEpisode } from "@/lib/toon-script";
import { listApprovedEpisodes } from "@/lib/toon-cinema.functions";
import { supabase } from "@/integrations/supabase/client";

const ToonStage3D = lazy(() => import("@/components/toon/ToonStage3D"));

type Reel = { id: string; tag: string; make: () => ToonEpisode; by?: string | null };
const REELS: Reel[] = [
  { id: "citadel", tag: "FEATURED TEASER", make: () => structuredClone(CITADEL_TEASER) },
  { id: "halving", tag: "EPISODE", make: () => generateEpisode(840000, 77819) },
  { id: "hermit", tag: "EPISODE", make: () => generateEpisode(208, 715093) },
  { id: "genesis", tag: "EPISODE", make: () => generateEpisode(9, 170) },
];

export const Route = createFileRoute("/watch")({
  validateSearch: (s: Record<string, unknown>) => ({ ep: typeof s['ep'] === "string" ? s['ep'] : undefined }),
  head: () => {
    const title = "Toon Cinema — Watch BITMAP Guardian Cartoons";
    const description =
      "Press play on cartoon episodes starring BITMAP Guardians, filmed on real Bitcoin blocks and inscribed voxel builds. Free to watch in your browser.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: WatchPage,
});

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function WatchPage() {
  const { ep } = Route.useSearch();
  const navigate = Route.useNavigate();
  const approved = useQuery({ queryKey: ["toon-cinema-approved"], queryFn: () => listApprovedEpisodes(), staleTime: 60_000 });
  // Pending/rejected episodes are only visible to their creator or a reviewer (preview from the queue).
  const [privateReel, setPrivateReel] = useState<{ id: string; tag: string; episode: ToonEpisode; by: string | null } | null>(null);
  const reels = useMemo(() => {
    const out: { id: string; tag: string; episode: ToonEpisode; by?: string | null }[] = [];
    for (const a of approved.data ?? []) {
      try { out.push({ id: a.id, tag: "COMMUNITY EPISODE", episode: parseEpisode(a.episode), by: a.creator_name }); } catch { /* skip invalid */ }
    }
    const built = REELS.map((r) => ({ id: r.id, tag: r.tag, episode: r.make() }));
    return [built[0]!, ...out, ...built.slice(1), ...(privateReel && !out.some((o) => o.id === privateReel.id) ? [privateReel] : [])];
  }, [approved.data, privateReel]);
  useEffect(() => {
    if (!ep || REELS.some((r) => r.id === ep) || approved.isLoading || (approved.data ?? []).some((a) => a.id === ep)) return;
    void supabase.from("toon_submissions").select("id, title, creator_name, episode, status").eq("id", ep).maybeSingle().then(({ data }) => {
      if (!data) return;
      try { setPrivateReel({ id: data.id, tag: `PREVIEW · ${String(data.status).toUpperCase()}`, episode: parseEpisode(JSON.stringify(data.episode)), by: data.creator_name }); } catch { /* invalid */ }
    });
  }, [ep, approved.isLoading, approved.data]);
  const current = reels.find((r) => r.id === ep) ?? reels[0]!;
  const episode = current.episode;
  const total = useMemo(() => episodeLength(episode), [episode]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const timeRef = useRef(0);
  timeRef.current = time;
  const screenRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const soundRef = useRef<{ id: string; buf: Promise<AudioBuffer | null> } | null>(null);

  useEffect(() => { setTime(0); setPlaying(false); }, [current.id]);

  useEffect(() => {
    if (!playing || muted) return;
    if (soundRef.current?.id !== current.id) soundRef.current = { id: current.id, buf: renderSoundtrack(episode).catch(() => null) };
    let stop = () => {}, live = true;
    void soundRef.current.buf.then((b) => { if (b && live) stop = playSoundtrack(b, timeRef.current); });
    return () => { live = false; stop(); };
  }, [playing, muted, current.id, episode]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const next = timeRef.current + (now - last) / 1000;
      last = now;
      if (next >= total) { setTime(total); setPlaying(false); return; }
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width) || c.height !== Math.round(r.height)) { c.width = Math.round(r.width); c.height = Math.round(r.height); }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawOverlay(ctx, c.width, c.height, episode, time);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => drawOverlay(ctx, c.width, c.height, episode, timeRef.current)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [episode, time]);

  const scene = episode.scenes[sceneAt(episode, time).index];
  const blocks = [...new Set(episode.scenes.map((s) => s.block))];
  const cast = [...new Map(episode.scenes.flatMap((s) => s.cast).map((c) => [c.height, c])).values()];
  const vertical = episode.aspect === "9:16";

  const fullscreen = () => { const el = screenRef.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.(); };
  const share = () => {
    const url = `https://bitmapwin.app/watch?ep=${current.id}`;
    const text = `Watching "${episode.title}" — a cartoon filmed on real Bitcoin blocks #Bitmap #Ordinals`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <div className="label text-bitcoin">MEDIA · CINEMA</div>
      <h1 className="display mt-2 text-2xl md:text-4xl">TOON CINEMA</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Cartoon episodes starring BITMAP Guardians, filmed on real Bitcoin blocks and inscribed voxel builds. Press play.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          <div ref={screenRef} className={`relative mx-auto overflow-hidden rounded-lg border border-border bg-card ${vertical ? "aspect-[9/16] max-h-[78vh]" : "aspect-video"}`}>
            <div className="absolute inset-0" style={{ filter: styleFilter(episode.style) }}>
              <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING SCREEN…</div>}>
                <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING SCREEN…</div>}>
                  <ToonStage3D key={current.id} episode={episode} time={time} />
                </Suspense>
              </ClientOnly>
            </div>
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            {!playing && (
              <button aria-label="Play episode" onClick={() => { if (time >= total) setTime(0); setPlaying(true); }}
                className="absolute inset-0 grid place-items-center bg-background/30 transition-colors hover:bg-background/10">
                <span className="grid size-20 place-items-center rounded-full border border-bitcoin bg-background/70 font-display text-3xl text-bitcoin">▶</span>
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
            <button className="btn-term" onClick={() => { if (time >= total) setTime(0); setPlaying((p) => !p); }}>[ {playing ? "❚❚ PAUSE" : "▶ PLAY"} ]</button>
            <input aria-label="Seek" type="range" min={0} max={total} step={0.05} value={time}
              onChange={(e) => setTime(Number(e.target.value))} className="min-w-[160px] flex-1 accent-[var(--bitcoin)]" />
            <span className="tabular-nums text-muted-foreground">{fmt(time)} / {fmt(total)}</span>
            <button className="btn-term-ghost" onClick={() => setMuted((m) => !m)}>[ SOUND {muted ? "OFF" : "ON"} ]</button>
            <button className="btn-term-ghost" onClick={fullscreen}>[ ⛶ FULLSCREEN ]</button>
          </div>

          <section className="mt-5 grid gap-4 border border-border p-4 md:grid-cols-2">
            <div>
              <div className="label">NOW SHOWING</div>
              <div className="display mt-1 text-xl">{episode.title}</div>
              {scene && (
                <div className="mt-2 font-mono text-xs text-muted-foreground">
                  ON LOCATION · <Link to="/bitmap/$block" params={{ block: String(scene.block) }} className="text-bitcoin hover:underline">{scene.block}.BITMAP</Link>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-term" onClick={share}>[ SHARE TO X ]</button>
                <Link to="/toon" className="btn-term-ghost">[ MAKE YOUR OWN IN TOON STUDIO ]</Link>
              </div>
            </div>
            <div>
              <div className="label">FILMED ON</div>
              <div className="mt-1 flex flex-wrap gap-2 font-mono text-xs">
                {blocks.map((b) => (
                  <Link key={b} to="/bitmap/$block" params={{ block: String(b) }} className="border border-border px-2 py-1 hover:border-bitcoin hover:text-bitcoin">{b}.BITMAP</Link>
                ))}
              </div>
              <div className="label mt-3">STARRING</div>
              <div className="mt-1 flex flex-wrap gap-2 font-mono text-xs">
                {cast.map((c) => (
                  <Link key={c.height} to="/bitmap/$block" params={{ block: String(c.height) }} className="border border-border px-2 py-1 text-signal hover:border-signal">GUARDIAN {c.height}</Link>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside>
          <div className="label">PLAYLIST</div>
          <ol className="mt-2 space-y-2">
            {reels.map((r) => {
              const active = r.id === current.id;
              return (
                <li key={r.id}>
                  <button onClick={() => void navigate({ search: { ep: r.id } })}
                    className={`w-full border p-3 text-left transition-colors ${active ? "border-bitcoin bg-secondary" : "border-border hover:border-bitcoin/60"}`}>
                    <div className={`label ${active ? "text-bitcoin" : ""}`}>{active ? "▶ NOW PLAYING" : r.tag}</div>
                    <div className="display mt-1 text-base">{r.episode.title}</div>
                    {r.by && <div className="font-mono text-[0.65rem] text-bitcoin">BY {r.by}</div>}
                    <div className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                      {fmt(episodeLength(r.episode))} · {r.episode.scenes.length} SCENES · {[...new Set(r.episode.scenes.map((s) => s.block))].join(" → ")}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}
