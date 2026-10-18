import { useState } from "react";
import { newId, type ContinuityNote } from "@/lib/toon-library";

const field = "w-full border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground";

/** Editable notebook in the series panel. */
export function ContinuityNotebook({ notes, episodeTitle, onChange }: { notes: ContinuityNote[]; episodeTitle: string; onChange: (n: ContinuityNote[]) => void }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<ContinuityNote["kind"]>("event");
  const add = () => {
    if (!text.trim()) return;
    onChange([...notes, { id: newId(), kind, text: text.trim().slice(0, 400), episode: episodeTitle, at: Date.now() }]);
    setText("");
  };
  return (
    <div className="mt-4">
      <div className="label text-signal">CONTINUITY NOTEBOOK</div>
      <p className="mt-1 text-[11px] text-muted-foreground">What happened, and storylines still open. Shown beside the dialogue editor.</p>
      <div className="mt-2 flex gap-2">
        <select className={`${field} w-28`} value={kind} onChange={(e) => setKind(e.target.value as ContinuityNote["kind"])} aria-label="Note type">
          <option value="event">Event</option><option value="thread">Open storyline</option>
        </select>
        <input className={field} value={text} placeholder={kind === "event" ? "e.g. Halving lost his shard" : "e.g. Who stole the shard?"} aria-label="Note text"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="border border-border px-2 font-mono text-[11px] hover:border-bitcoin disabled:opacity-40" disabled={!text.trim()} onClick={add}>ADD</button>
      </div>
      <ul className="mt-2 space-y-1">
        {[...notes].reverse().map((n) => (
          <li key={n.id} className={`flex items-start gap-2 border border-border px-2 py-1 text-[11px] ${n.resolved ? "opacity-50" : ""}`}>
            <span className={`font-mono ${n.kind === "thread" ? "text-bitcoin" : "text-signal"}`}>{n.kind === "thread" ? "?" : "•"}</span>
            <span className="flex-1"><span className={n.resolved ? "line-through" : ""}>{n.text}</span> <span className="font-mono text-muted-foreground">· {n.episode}</span></span>
            {n.kind === "thread" && (
              <button className="font-mono text-signal hover:text-bitcoin" onClick={() => onChange(notes.map((x) => (x.id === n.id ? { ...x, resolved: !x.resolved } : x)))}>{n.resolved ? "REOPEN" : "RESOLVE"}</button>
            )}
            <button aria-label="Delete note" className="font-mono text-muted-foreground hover:text-bitcoin" onClick={() => { if (confirm("Delete this note?")) onChange(notes.filter((x) => x.id !== n.id)); }}>✕</button>
          </li>
        ))}
        {notes.length === 0 && <li className="text-[11px] text-muted-foreground">No notes yet.</li>}
      </ul>
    </div>
  );
}

/** Read-only summary shown above the dialogue editor: open storylines first, then latest events. */
export function ContinuityHint({ notes }: { notes: ContinuityNote[] }) {
  const open = notes.filter((n) => n.kind === "thread" && !n.resolved);
  const events = notes.filter((n) => n.kind === "event").slice(-4).reverse();
  if (!open.length && !events.length) return null;
  return (
    <div className="mt-2 max-h-48 overflow-y-auto border-l-2 border-signal bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
      {open.length > 0 && <div className="font-mono text-bitcoin">OPEN STORYLINES</div>}
      {open.map((n) => <div key={n.id}>? {n.text} <span className="font-mono">· {n.episode}</span></div>)}
      {events.length > 0 && <div className="mt-1 font-mono text-signal">RECENT EVENTS</div>}
      {events.map((n) => <div key={n.id}>• {n.text} <span className="font-mono">· {n.episode}</span></div>)}
    </div>
  );
}
