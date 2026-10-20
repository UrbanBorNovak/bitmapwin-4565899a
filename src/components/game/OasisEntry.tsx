import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASSES, readClass, saveClass, type ClassId } from "@/lib/oasis-classes";
import { CharacterPortrait } from "@/components/game/CharacterPortrait";
import { BITMAP_PIXELS_INSCRIPTION, getBitmapPixelsCollection } from "@/lib/bitmap-pixels.functions";
import {
  OFFICIAL_RIGS,
  avatarModelInscription,
  avatarSkinInscription,
  setAvatarModelInscription,
  setAvatarSkinInscription,
} from "@/lib/map-identity";
import { readCharacter, saveCharacter } from "@/lib/character";

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

  const readSkins = useServerFn(getBitmapPixelsCollection);
  const collection = useQuery({
    queryKey: ["bitmap-pixels-collection", BITMAP_PIXELS_INSCRIPTION],
    queryFn: () => readSkins(),
    staleTime: Infinity,
    retry: 1,
  });
  const skins = collection.data?.pixels ?? [];
  const [skin, setSkin] = useState<string | null>(null);
  const [rigIndex, setRigIndex] = useState(0);
  useEffect(() => {
    const worn = avatarModelInscription();
    const i = OFFICIAL_RIGS.findIndex((r) => r.id === worn);
    if (i > 0) setRigIndex(i);
  }, []);
  useEffect(() => {
    setSkin(readCharacter()?.avatarSkin ?? avatarSkinInscription() ?? null);
  }, []);
  const stepRef = useRef<(d: number) => void>(() => {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage === "prologue" && (e.code === "Space" || e.code === "Escape" || e.code === "Enter")) {
        e.preventDefault();
        setStage("class");
      } else if (stage === "class" && !(e.target instanceof HTMLInputElement)) {
        if (e.code === "ArrowLeft") stepRef.current(-1);
        if (e.code === "ArrowRight") stepRef.current(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  const chosen = CLASSES.find((c) => c.id === pick)!;

  const stepRig = (dir: number) =>
    setRigIndex((i) => (((i + dir) % OFFICIAL_RIGS.length) + OFFICIAL_RIGS.length) % OFFICIAL_RIGS.length);

  const enter = () => {
    saveClass(pick);
    if (name.trim()) window.localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
    setAvatarSkinInscription(skin);
    // The stock figure is stored as "no model", the second rig by its id.
    const model = rigIndex === 0 ? null : OFFICIAL_RIGS[rigIndex]!.id;
    setAvatarModelInscription(model);
    const existing = readCharacter();
    if (existing) saveCharacter({ ...existing, avatarSkin: skin, avatarModel: model });
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

  const skinCount = skins.length + 1;
  const skinIndex = skin ? skins.findIndex((s) => s.inscriptionId === skin) + 1 : 0;
  const stepSkin = (dir: number) => {
    const next = (((skinIndex + dir) % skinCount) + skinCount) % skinCount;
    setSkin(next === 0 ? null : skins[next - 1]!.inscriptionId);
  };
  stepRef.current = stepSkin;
  const skinLabel = skinIndex === 0 ? "STOCK EXPLORER" : skins[skinIndex - 1]?.name ?? "—";

  return (
    <div className="relative grid min-h-[82vh] gap-4 overflow-hidden border border-border bg-background p-4 lg:grid-cols-[240px_1fr_300px]">
      {/* LEFT — callings + appearance */}
      <aside className="z-10 flex flex-col gap-4 border border-border bg-card/70 p-3 backdrop-blur-sm">
        <div role="radiogroup" aria-label="Class" className="space-y-1.5">
          <p className="label text-signal">CALLING</p>
          {CLASSES.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={pick === c.id}
              onClick={() => setPick(c.id)}
              className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left font-mono text-xs transition-colors ${
                pick === c.id ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="grid size-7 shrink-0 place-items-center border border-current font-display text-[11px]">
                {c.name.slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{c.name}</span>
                <span className="block truncate text-[9px] opacity-70">{c.role}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5" data-no-translate>
          <p className="label text-signal">APPEARANCE</p>
          <Stepper label="MODEL" value={OFFICIAL_RIGS[rigIndex]!.label} onStep={stepRig} />
          <Stepper label="SKIN" value={`#${String(skinIndex).padStart(3, "0")}`} onStep={stepSkin} />
          <p className="truncate font-mono text-[10px] text-bitcoin">{skinLabel}</p>
          <p className="font-mono text-[9px] text-muted-foreground">
            {skinCount} ON-CHAIN SKINS · SCROLL OVER FIGURE OR ← →
          </p>
        </div>

        <Button
          variant="outline"
          className="mt-auto"
          onClick={() => {
            setSkin(skins.length ? skins[Math.floor(Math.random() * skins.length)]!.inscriptionId : null);
            setPick(CLASSES[Math.floor(Math.random() * CLASSES.length)]!.id);
          }}
        >
          <Dices className="size-3.5" /> RANDOMIZE
        </Button>
      </aside>

      {/* CENTER — figure on pedestal */}
      <section className="relative flex min-h-[460px] min-w-0 flex-col">
        <div
          className="relative min-h-[420px] min-w-0 flex-1 overflow-hidden"
          onWheel={(e) => stepSkin(e.deltaY > 0 ? 1 : -1)}
          aria-label="Character preview — scroll to change skin"
        >
          <div className="pointer-events-none absolute inset-x-[15%] bottom-[6%] h-10 rounded-[50%] border border-bitcoin/50 bg-bitcoin/10 shadow-[0_0_60px_-6px_hsl(var(--bitcoin,30_93%_54%))]" />
          {/* Absolutely placed so the 3D view can never push its own box wider —
              that feedback loop grew the canvas past what any GPU can draw. */}
          <div className="absolute inset-0">
            <CharacterPortrait model={OFFICIAL_RIGS[rigIndex]!.id} skin={skin} className="h-full w-full" />
          </div>
          <button
            aria-label="Previous skin"
            onClick={() => stepSkin(-1)}
            className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center border border-border bg-card/80 text-signal hover:border-bitcoin"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            aria-label="Next skin"
            onClick={() => stepSkin(1)}
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center border border-border bg-card/80 text-signal hover:border-bitcoin"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2 pt-2">
          <p className="label text-bitcoin">NAME</p>
          <Input
            value={name}
            maxLength={24}
            placeholder="YOUR NAME"
            className="text-center"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </section>

      {/* RIGHT — lore panels */}
      <aside className="z-10 flex flex-col gap-3">
        <Panel title="THE OASIS">
          One million BITMAPs, one per block, each a district of parcels. Land is held by keys, not by permission.
        </Panel>
        <Panel title={chosen.name}>
          <span className="block text-signal">{chosen.role}</span>
          {chosen.lore}
        </Panel>
        <Panel title="SKILLS">
          {chosen.skills.map((s, i) => (
            <span key={s.name} className="mb-1.5 block">
              <span className="text-signal">[{i + 7}]</span> <span className="text-foreground">{s.name}</span> ·{" "}
              {s.cooldown}S — {s.note}
            </span>
          ))}
        </Panel>
        <div className="mt-auto flex flex-col gap-2">
          <Button onClick={enter}>ACCEPT · ENTER 0.BITMAP →</Button>
          <Button variant="ghost" onClick={() => { setLine(0); setStage("prologue"); }}>
            ← BACK
          </Button>
        </div>
      </aside>
    </div>
  );
}

function Stepper({ label, value, onStep }: { label: string; value: string; onStep: (d: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="flex-1 border border-border px-2 py-1 font-mono text-[10px]">
        {label} <span className="text-bitcoin">{value}</span>
      </span>
      <button aria-label={`Previous ${label}`} onClick={() => onStep(-1)} className="grid size-6 place-items-center border border-border hover:border-bitcoin">
        <ChevronLeft className="size-3" />
      </button>
      <button aria-label={`Next ${label}`} onClick={() => onStep(1)} className="grid size-6 place-items-center border border-border hover:border-bitcoin">
        <ChevronRight className="size-3" />
      </button>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card/70 backdrop-blur-sm">
      <p className="border-b border-border px-3 py-1.5 font-display text-sm text-bitcoin">{title}</p>
      <div className="max-h-40 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
