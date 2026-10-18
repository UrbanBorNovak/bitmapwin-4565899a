import { useState } from "react";
import { newId, notesFor, type ContinuityNote, type ToonCharacter } from "@/lib/toon-library";

const field = "w-full border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground";
const label = (characters: ToonCharacter[], h: number) => characters.find((c) => c.height === h)?.nickname || `${h}.bitmap`;

/** Character chips: toggle (multi) or pick-one filter with an ALL option. */
function Chips({ characters, selected, onToggle, all }: { characters: ToonCharacter[]; selected: number[]; onToggle: (h: number | null) => void; all?: boolean }) {
  if (!characters.length) return null;
  const chip = (on: boolean) => `border px-1.5 py-0.5 font-mono text-[10px] ${on ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`;
  return (
    <div className="flex flex-wrap gap-1">
      {all && <button className={chip(selected.length === 0)} onClick={() => onToggle(null)}>ALL</button>}
      {characters.map((c) => (
        <button key={c.height} className={chip(selected.includes(c.height))} aria-pressed={selected.includes(c.height)} onClick={() => onToggle(c.height)}>
          {label(characters, c.height)}
        </button>
      ))}
    </div>
  );
}

const Tags = ({ n, characters }: { n: ContinuityNote; characters: ToonCharacter[] }) =>
  n.guardians?.length ? <span className="font-mono text-[10px] text-bitcoin"> [{n.guardians.map((h) => label(characters, h)).join(", ")}]</span> : null;

/** Editable notebook in the series panel. */
export function ContinuityNotebook({ notes, characters, episodeTitle, onChange }: { notes: ContinuityNote[]; characters: ToonCharacter[]; episodeTitle: string; onChange: (n: ContinuityNote[]) => void }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<ContinuityNote["kind"]>("event");
  const [tags, setTags] = useState<number[]>([]);
  const [filter, setFilter] = useState<number | null>(null);
  const add = () => {
    if (!text.trim()) return;
    onChange([...notes, { id: newId(), kind, text: text.trim().slice(0, 400), episode: episodeTitle, at: Date.now(), ...(tags.length ? { guardians: tags } : {}) }]);
    setText("");
  };
  const toggleTag = (h: number | null) => h !== null && setTags((t) => (t.includes(h) ? t.filter((x) => x !== h) : [...t, h]));
  const retag = (n: ContinuityNote, h: number) => {
    const g = n.guardians ?? [];
    const next = g.includes(h) ? g.filter((x) => x !== h) : [...g, h];
    onChange(notes.map((x) => (x.id === n.id ? { ...x, guardians: next } : x)));
  };
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="mt-4">
      <div className="label text-signal">CONTINUITY NOTEBOOK</div>
      <p className="mt-1 text-[11px] text-muted-foreground">What happened, and storylines still open. Tag the Guardians involved.</p>
      <div className="mt-2 flex gap-2">
        <select className={`${field} w-28`} value={kind} onChange={(e) => setKind(e.target.value as ContinuityNote["kind"])} aria-label="Note type">
          <option value="event">Event</option><option value="thread">Open storyline</option>
        </select>
        <input className={field} value={text} placeholder={kind === "event" ? "e.g. Halving lost his shard" : "e.g. Who stole the shard?"} aria-label="Note text"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="border border-border px-2 font-mono text-[11px] hover:border-bitcoin disabled:opacity-40" disabled={!text.trim()} onClick={add}>ADD</button>
      </div>
      {characters.length > 0 && (
        <div className="mt-1 flex items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">TAG:</span><Chips characters={characters} selected={tags} onToggle={toggleTag} /></div>
      )}
      {characters.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">Add characters above to tag notes with them.</p>}
      {characters.length > 0 && notes.length > 0 && (
        <div className="mt-3 flex items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">SHOW:</span><Chips all characters={characters} selected={filter === null ? [] : [filter]} onToggle={setFilter} /></div>
      )}
      <ul className="mt-2 space-y-1">
        {[...notesFor(notes, filter)].reverse().map((n) => (
          <li key={n.id} className={`border border-border px-2 py-1 text-[11px] ${n.resolved ? "opacity-50" : ""}`}>
            <div className="flex items-start gap-2">
              <span className={`font-mono ${n.kind === "thread" ? "text-bitcoin" : "text-signal"}`}>{n.kind === "thread" ? "?" : "•"}</span>
              <span className="flex-1"><span className={n.resolved ? "line-through" : ""}>{n.text}</span><Tags n={n} characters={characters} /> <span className="font-mono text-muted-foreground">· {n.episode}</span></span>
              {characters.length > 0 && <button className="font-mono text-muted-foreground hover:text-bitcoin" onClick={() => setEditing(editing === n.id ? null : n.id)}>TAGS</button>}
              {n.kind === "thread" && (
                <button className="font-mono text-signal hover:text-bitcoin" onClick={() => onChange(notes.map((x) => (x.id === n.id ? { ...x, resolved: !x.resolved } : x)))}>{n.resolved ? "REOPEN" : "RESOLVE"}</button>
              )}
              <button aria-label="Delete note" className="font-mono text-muted-foreground hover:text-bitcoin" onClick={() => { if (confirm("Delete this note?")) onChange(notes.filter((x) => x.id !== n.id)); }}>✕</button>
            </div>
            {editing === n.id && <div className="mt-1"><Chips characters={characters} selected={n.guardians ?? []} onToggle={(h) => h !== null && retag(n, h)} /></div>}
          </li>
        ))}
        {notesFor(notes, filter).length === 0 && <li className="text-[11px] text-muted-foreground">{notes.length ? "No notes for this Guardian." : "No notes yet."}</li>}
      </ul>
    </div>
  );
}

/** Summary above the dialogue editor, filterable by character: open storylines first, then latest events. */
export function ContinuityHint({ notes, characters }: { notes: ContinuityNote[]; characters: ToonCharacter[] }) {
  const [filter, setFilter] = useState<number | null>(null);
  const shown = notesFor(notes, filter);
  const open = shown.filter((n) => n.kind === "thread" && !n.resolved);
  const events = shown.filter((n) => n.kind === "event").slice(-4).reverse();
  if (!notes.length) return null;
  return (
    <div className="mt-2 border-l-2 border-signal bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
      {characters.length > 0 && <div className="mb-1"><Chips all characters={characters} selected={filter === null ? [] : [filter]} onToggle={setFilter} /></div>}
      <div className="max-h-48 overflow-y-auto">
        {open.length > 0 && <div className="font-mono text-bitcoin">OPEN STORYLINES</div>}
        {open.map((n) => <div key={n.id}>? {n.text}<Tags n={n} characters={characters} /> <span className="font-mono">· {n.episode}</span></div>)}
        {events.length > 0 && <div className="mt-1 font-mono text-signal">RECENT EVENTS</div>}
        {events.map((n) => <div key={n.id}>• {n.text}<Tags n={n} characters={characters} /> <span className="font-mono">· {n.episode}</span></div>)}
        {!open.length && !events.length && <div>No notes for this Guardian.</div>}
      </div>
    </div>
  );
}
