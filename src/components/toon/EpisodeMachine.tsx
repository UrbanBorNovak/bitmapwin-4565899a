import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { writeEpisodeFn } from "@/lib/episode-machine.functions";
import { beatsToEpisode, PITCH_CHIPS, PITCH_MAX } from "@/lib/episode-machine";
import type { ToonEpisode } from "@/lib/toon-script";

/** One-line pitch → AI beat sheet → playable episode loaded straight onto the stage. */
export function EpisodeMachine({ onEpisode, disabled, initialPitch = "" }: { onEpisode: (e: ToonEpisode) => void; disabled?: boolean; initialPitch?: string }) {
  const write = useServerFn(writeEpisodeFn);
  const [pitch, setPitch] = useState(initialPitch);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ score: number; text: string } | null>(null);

  const go = async () => {
    setBusy(true); setErr(null); setVerdict(null);
    try {
      const r = await write({ data: { pitch } });
      if (!r.ok) return setErr(r.error);
      onEpisode(beatsToEpisode(r.beats));
      setVerdict({ score: Math.round(Math.max(1, Math.min(10, r.beats.score))), text: r.beats.verdict });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "SCRIPT FAILED");
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-lg border border-primary/40 bg-card p-4">
      <div className="label text-primary">EPISODE MACHINE</div>
      <p className="mt-1 text-xs text-muted-foreground">Pitch one line. The writers' room scripts a 3-scene cartoon and it plays on the stage — then export the video.</p>
      <textarea value={pitch} maxLength={PITCH_MAX} onChange={(e) => setPitch(e.target.value)} rows={3} aria-label="Episode pitch"
        placeholder="A Block 0 maxi tries to pay for an espresso…" className="mt-3 w-full border border-border bg-background px-2 py-1 font-mono text-xs" />
      <div className="mt-2 flex flex-wrap gap-1">
        {PITCH_CHIPS.map((c) => (
          <button key={c} type="button" onClick={() => setPitch(c)} className="border border-border px-2 py-0.5 text-left font-mono text-[10px] text-muted-foreground hover:text-foreground">{c}</button>
        ))}
      </div>
      <button className="btn-term mt-3 w-full" disabled={busy || disabled || pitch.trim().length < 8} onClick={() => void go()}>
        {busy ? "[ WRITERS' ROOM IS TYPING… ]" : "[ GREENLIGHT EPISODE ]"}
      </button>
      {err && <p className="mt-2 font-mono text-[11px] text-destructive">&gt; {err}</p>}
      {verdict && <p className="mt-2 font-mono text-[11px] text-signal">&gt; GREENLIT · {verdict.score}/10 · {verdict.text}</p>}
    </section>
  );
}
