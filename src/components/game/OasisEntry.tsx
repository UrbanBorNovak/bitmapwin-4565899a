import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASSES, readClass, saveClass, type ClassId } from "@/lib/oasis-classes";

const PROLOGUE = [
  "JANUARY 3, 2009.",
  "THE CHANCELLOR ON BRINK OF SECOND BAILOUT FOR BANKS.",
  "BLOCK 0 WAS ETCHED INTO THE LEDGER, AND IT COULD NEVER BE UNWRITTEN.",
  "EVERY BLOCK SINCE BECAME A DISTRICT. EVERY TRANSACTION, A PARCEL OF LAND.",
  "ONE MILLION BITMAPS NOW STRETCH ACROSS THE OASIS.",
  "CHOOSE YOUR CALLING. YOUR JOURNEY BEGINS AT 0.BITMAP.",
];

const NAME_KEY = "bitmapwin:oasis-name";

/** Story prologue → class pick → enter world. Calls onEnter when done. */
export function OasisEntry({ onEnter }: { onEnter: () => void }) {
  const [stage, setStage] = useState<"prologue" | "class">("prologue");
  const [line, setLine] = useState(0);
  const [pick, setPick] = useState<ClassId>("miner");
  const [name, setName] = useState("");

  useEffect(() => {
    const saved = readClass();
    if (saved) setPick(saved);
    setName(window.localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  useEffect(() => {
    if (stage !== "prologue") return;
    if (line >= PROLOGUE.length) {
      const t = window.setTimeout(() => setStage("class"), 1200);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setLine((l) => l + 1), 1700);
    return () => window.clearTimeout(t);
  }, [line, stage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage === "prologue" && (e.code === "Space" || e.code === "Escape" || e.code === "Enter")) {
        e.preventDefault();
        setStage("class");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  const chosen = CLASSES.find((c) => c.id === pick)!;

  const enter = () => {
    saveClass(pick);
    if (name.trim()) window.localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
    onEnter();
  };

  if (stage === "prologue") {
    return (
      <div className="relative grid h-[78vh] min-h-[520px] place-items-center border border-border bg-background px-6">
        <div className="max-w-2xl space-y-4 text-center">
          {PROLOGUE.slice(0, line).map((text, i) => (
            <p
              key={i}
              className={`animate-in fade-in duration-1000 font-mono text-sm tracking-widest ${
                i === PROLOGUE.length - 1 ? "text-bitcoin" : "text-foreground"
              }`}
            >
              {text}
            </p>
          ))}
        </div>
        <Button variant="ghost" className="absolute bottom-4 right-4 label text-signal" onClick={() => setStage("class")}>
          SKIP PROLOGUE [SPACE] →
        </Button>
      </div>
    );
  }

  return (
    <div className="grid min-h-[78vh] gap-4 border border-border bg-background p-4 md:grid-cols-[220px_1fr_260px]">
      <div className="space-y-2" role="radiogroup" aria-label="Class">
        <p className="label text-signal">CHOOSE YOUR CALLING</p>
        {CLASSES.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={pick === c.id}
            onClick={() => setPick(c.id)}
            className={`w-full border px-3 py-2 text-left font-mono text-xs transition-colors ${
              pick === c.id ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="block">{c.name}</span>
            <span className="block text-[10px] opacity-70">{c.role}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center gap-6 border border-border p-6 text-center">
        <div className="grid h-40 w-40 place-items-center rounded-full border border-bitcoin/60 shadow-[0_0_60px_-10px_hsl(var(--bitcoin,30_93%_54%))]">
          <span className="font-display text-3xl text-bitcoin">{chosen.name.slice(0, 2)}</span>
        </div>
        <div>
          <h2 className="font-display text-2xl text-foreground">{chosen.name}</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{chosen.lore}</p>
        </div>
        <div className="grid w-full max-w-lg grid-cols-3 gap-2">
          {chosen.skills.map((s, i) => (
            <div key={s.name} className="border border-border p-2 font-mono text-[10px]">
              <span className="block text-signal">[{i + 7}]</span>
              <span className="block text-foreground">{s.name}</span>
              <span className="block text-muted-foreground">{s.note} · {s.cooldown}S</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="label text-signal">TRAVELLER</p>
        <Input value={name} maxLength={24} placeholder="YOUR NAME" onChange={(e) => setName(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          You will arrive at the Genesis block, 0.bitmap. Class skills use keys 7, 8 and 9.
        </p>
        <Button className="mt-auto" onClick={enter}>ENTER THE OASIS →</Button>
      </div>
    </div>
  );
}
