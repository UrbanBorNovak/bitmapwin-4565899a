import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listChaptersFn } from "@/lib/biternam-chapter.functions";

/** Holder-published chapters appended to the story, newest first. */
export function CommunityChronicles() {
  const q = useQuery({ queryKey: ["biternam-chapters"], queryFn: () => listChaptersFn(), staleTime: 30_000 });
  return (
    <section className="mt-12 border-t border-border pt-10">
      <div className="font-mono text-[11px] tracking-[0.3em] text-bitcoin">COMMUNITY CHRONICLES</div>
      <p className="mt-2 text-sm text-muted-foreground">Chapters written by BITMAP holders, built from their own blocks.</p>
      <Link to="/biternam/chapters" className="mt-3 inline-block rounded border border-primary px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground">[ WRITE YOUR CHAPTER · FREE ]</Link>
      {(q.data ?? []).map((c) => (
        <section key={c.height} className="mt-8">
          <div className="font-mono text-[11px] tracking-[0.2em] text-signal" data-no-translate>CH.{c.height}</div>
          <h3 className="mt-1 font-display text-xl">{c.title}</h3>
          <blockquote className="mt-3 border-l-2 border-bitcoin pl-3 font-mono text-sm text-muted-foreground">"{c.quote}"</blockquote>
          <Link to="/biternam/chapters" search={{ block: c.height }} className="mt-3 inline-block rounded border border-signal px-3 py-1.5 font-mono text-xs text-signal hover:bg-signal hover:text-background">[ ▶ WATCH CH.{c.height} ]</Link>
        </section>
      ))}
    </section>
  );
}
