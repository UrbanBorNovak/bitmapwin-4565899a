import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/lib/auth";
import { useChainTip } from "@/lib/use-chain-tip";
import { episodeLength, sceneAt } from "@/lib/toon-script";
import { styleFilter } from "@/lib/toon-style";
import { QUOTE_MAX, TITLE_MAX, chapterEpisode, chapterTheme, defaultQuote, defaultTitle } from "@/lib/biternam-chapter";
import { blockFactsFn, listChaptersFn, publishChapterFn } from "@/lib/biternam-chapter.functions";

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

  const facts = useQuery({ queryKey: ["block-facts", height], queryFn: () => blockFactsFn({ data: { height } }) });
  const chapters = useQuery({ queryKey: ["biternam-chapters"], queryFn: () => listChaptersFn(), staleTime: 30_000 });
  const f = { height, txCount: facts.data?.txCount ?? null };
  const existing = chapters.data?.find((c) => c.height === height);

  useEffect(() => { setTitle(existing?.title ?? defaultTitle(f)); setQuote(existing?.quote ?? defaultQuote(f)); setMsg(null); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [height, facts.data?.txCount, existing?.title]);

  const episode = useMemo(() => chapterEpisode(f, title || defaultTitle(f), quote || defaultQuote(f)), [height, f.txCount, title, quote]);
  const total = episodeLength(episode);
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
  const at = sceneAt(episode, time);
  const line = at ? at.scene.lines.find((l) => at.local >= l.at && at.local < l.at + l.dur) : undefined;
  const speaker = line && at ? at.scene.cast[line.speaker]?.name : undefined;

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
          <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-card">
            <div className="absolute inset-0" style={{ filter: styleFilter(episode.style) }}>
              <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING SCENE…</div>}>
                <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">LOADING SCENE…</div>}>
                  <ToonStage3D episode={episode} time={time} />
                </Suspense>
              </ClientOnly>
            </div>
            {line && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit max-w-[80%] rounded border border-border bg-background/85 px-3 py-2 text-center text-sm">
                <span className="font-mono text-[10px] text-signal">{speaker}</span><div>{line.text}</div>
              </div>
            )}
            {!playing && (
              <button aria-label="Preview chapter" onClick={() => { t0.current = time >= total ? 0 : time; setPlaying(true); }}
                className="absolute inset-0 grid place-items-center bg-background/30 hover:bg-background/10">
                <span className="grid size-20 place-items-center rounded-full border border-bitcoin bg-background/70 font-display text-3xl text-bitcoin">▶</span>
              </button>
            )}
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">{episode.title} · {Math.round(total)}s · rendered live in your browser</div>
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
            <span className="text-muted-foreground">TRANSACTIONS</span><span>{facts.isPending ? "…" : f.txCount == null ? "NOT RECORDED" : f.txCount.toLocaleString("en-US")}</span>
          </div>
          {beyondTip && <div className="text-destructive">UNMINED · BEYOND CHAIN TIP ({tip.toLocaleString("en-US")})</div>}
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
