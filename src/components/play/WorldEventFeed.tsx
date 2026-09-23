import type { WorldEventRecord } from "@/lib/game/types";

export function WorldEventFeed({ events, limit = 8 }: { events: WorldEventRecord[]; limit?: number }) {
  return (
    <section className="border border-border bg-card">
      <h2 className="label flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="size-1.5 bg-signal lc-blink" aria-hidden /> WORLD EVENTS
      </h2>
      {events.length ? (
        <ol aria-live="polite">
          {events.slice(0, limit).map((e) => (
            <li key={e.id} className="flex gap-3 border-b border-border/60 px-3 py-2 font-mono text-[10px] last:border-0">
              <span className="shrink-0 text-bitcoin">{e.kind.replace(/_/g, " ")}</span>
              <span className="min-w-0 flex-1">{e.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-3 py-4 font-mono text-[10px] text-muted-foreground">&gt; THE WORLD IS WAITING FOR YOUR FIRST MOVE_</p>
      )}
    </section>
  );
}
