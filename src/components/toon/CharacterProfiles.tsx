import { useEffect, useState } from "react";
import type { ToonCharacter } from "@/lib/toon-library";

const field = "w-full border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground";

/** One editable profile; saves when a field loses focus so autosync isn't hit on every keystroke. */
function ProfileCard({ c, onSave, onRemove }: { c: ToonCharacter; onSave: (c: ToonCharacter) => void; onRemove: () => void }) {
  const [d, setD] = useState(c);
  useEffect(() => setD(c), [c]);
  const blur = () => { if (JSON.stringify(d) !== JSON.stringify(c)) onSave(d); };
  const set = (k: keyof ToonCharacter) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value.slice(0, 280) });
  return (
    <li className="space-y-1 border border-border p-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-bitcoin">{c.height}.bitmap</span>
        <input className={field} value={d.nickname} placeholder="Character name" aria-label="Character name" onChange={set("nickname")} onBlur={blur} />
        <button aria-label="Remove character" className="font-mono text-[11px] text-muted-foreground hover:text-bitcoin" onClick={onRemove}>✕</button>
      </div>
      <textarea className={`${field} h-12`} value={d.personality} placeholder="Personality notes" aria-label="Personality" onChange={set("personality")} onBlur={blur} />
      <input className={field} value={d.voice} placeholder="Speaking style (e.g. short, shouty, loves puns)" aria-label="Speaking style" onChange={set("voice")} onBlur={blur} />
      <input className={field} value={d.relationships} placeholder="Relationships (e.g. rival of 77819)" aria-label="Relationships" onChange={set("relationships")} onBlur={blur} />
    </li>
  );
}

export function CharacterProfiles({ characters, castHeights, onChange }: { characters: ToonCharacter[]; castHeights: number[]; onChange: (c: ToonCharacter[]) => void }) {
  const missing = castHeights.filter((h) => !characters.some((c) => c.height === h));
  return (
    <div className="mt-4">
      <div className="label text-signal">CHARACTERS</div>
      <p className="mt-1 text-[11px] text-muted-foreground">Recurring Guardians in this series. Shown beside the dialogue editor while you write.</p>
      <ul className="mt-2 space-y-2">
        {characters.map((c) => (
          <ProfileCard key={c.height} c={c}
            onSave={(n) => onChange(characters.map((x) => (x.height === c.height ? n : x)))}
            onRemove={() => { if (confirm(`Remove ${c.nickname || `${c.height}.bitmap`} from this series?`)) onChange(characters.filter((x) => x.height !== c.height)); }} />
        ))}
      </ul>
      {missing.length > 0 && (
        <button className="mt-2 font-mono text-[11px] text-signal" onClick={() => onChange([...characters, ...missing.map((h) => ({ height: h, nickname: "", personality: "", voice: "", relationships: "" }))])}>
          + ADD {missing.length} GUARDIAN{missing.length > 1 ? "S" : ""} FROM THIS EPISODE
        </button>
      )}
    </div>
  );
}

/** Compact read-only card shown next to a dialogue line. */
export function CharacterHint({ c }: { c: ToonCharacter | undefined }) {
  if (!c || !(c.nickname || c.personality || c.voice || c.relationships)) return null;
  return (
    <div className="border-l-2 border-bitcoin bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
      <span className="font-mono text-bitcoin">{c.nickname || `${c.height}.bitmap`}</span>
      {c.voice && <> · <span className="text-foreground">speaks: {c.voice}</span></>}
      {c.personality && <div>{c.personality}</div>}
      {c.relationships && <div className="text-signal">↔ {c.relationships}</div>}
    </div>
  );
}
