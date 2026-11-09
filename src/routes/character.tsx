import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dices, Save } from "lucide-react";
import {
  CALLINGS,
  ORIGINS,
  OATHS,
  VICES,
  blankCharacter,
  readCharacter,
  saveCharacter,
  writeBackstory,
  writeTitle,
  type Character,
} from "@/lib/character";
import { CharacterPortrait } from "@/components/game/CharacterPortrait";
import { SkinRack } from "@/components/game/SkinRack";
import {
  avatarModelInscription,
  avatarSkinInscription,
  setAvatarModelInscription,
  setAvatarSkinInscription,
} from "@/lib/map-identity";

export const Route = createFileRoute("/character")({
  head: () => ({
    meta: [
      { title: "Create Your Character — Name, Look and Backstory" },
      {
        name: "description",
        content:
          "Name your Oasis character, pick an origin, calling, vice and oath, wear an on-chain figure and get a written backstory — all generated in your browser.",
      },
      { property: "og:title", content: "Create Your Character — Name, Look and Backstory" },
      {
        property: "og:description",
        content: "Build the person you walk the Oasis as: name, on-chain figure, traits and a backstory written on the spot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CharacterPage,
});

function CharacterPage() {
  const [draft, setDraft] = useState<Character>(() => blankCharacter());
  const [saved, setSaved] = useState<number>(0);

  useEffect(() => {
    const stored = readCharacter();
    if (stored) setDraft(stored);
    else {
      const worn = avatarModelInscription();
      const skin = avatarSkinInscription();
      if (worn || skin) setDraft((d) => ({ ...d, avatarModel: worn ?? d.avatarModel, avatarSkin: skin ?? d.avatarSkin }));
    }
  }, []);

  const title = writeTitle(draft);
  const backstory = writeBackstory(draft);

  const set = (patch: Partial<Character>) => setDraft((d) => ({ ...d, ...patch }));

  const commit = () => {
    const stored = saveCharacter({ ...draft, title, backstory });
    setDraft(stored);
    setAvatarModelInscription(stored.avatarModel);
    setAvatarSkinInscription(stored.avatarSkin);
    setSaved(Date.now());
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <ClientOnly fallback={null}>
        <iframe
          src="/oasis?height=0"
          title="Oasis backdrop"
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none fixed inset-x-0 -top-24 -z-20 h-[calc(100%+6rem)] w-full border-0 opacity-45 blur-[2px]"
        />
      </ClientOnly>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-background/55" aria-hidden="true" />
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <p className="label">CHARACTER</p>
      <h1 className="display mt-4 text-4xl md:text-6xl">WHO YOU ARE</h1>
      <p className="mt-4 max-w-[70ch] font-mono text-sm text-muted-foreground">
        &gt; PICK A NAME, A PAST AND A FIGURE — THE STORY IS WRITTEN HERE IN YOUR BROWSER, NOTHING IS SENT ANYWHERE
        <span className="blink">_</span>
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="border border-border bg-background/60 backdrop-blur-md">
          <header className="border-b border-border p-5">
            <h2 className="display text-xl">THE SHEET</h2>
            <p className="label mt-2">FOUR CHOICES SHAPE THE WRITING</p>
          </header>

          <div className="space-y-6 p-5">
            <label className="block">
              <span className="label">NAME</span>
              <input
                value={draft.name}
                onChange={(event) => set({ name: event.target.value.slice(0, 24) })}
                placeholder="DUSTY MAC"
                maxLength={24}
                className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-[0.12em] outline-none focus:border-bitcoin"
              />
            </label>

            <label className="block">
              <span className="label">FIGURE — ON-CHAIN INSCRIPTION ID (OPTIONAL)</span>
              <input
                value={draft.avatarModel ?? ""}
                onChange={(event) => set({ avatarModel: event.target.value.trim() || null })}
                placeholder="LEAVE EMPTY FOR THE DEFAULT FIGURE"
                className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
              />
            </label>

            <Link to="/avatars" search={{ id: draft.avatarSkin ?? undefined }} className="block border border-bitcoin/50 p-3 hover:bg-bitcoin/10">
              <span className="label text-bitcoin">AVATAR STUDIO →</span>
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">SEE EVERY BITMAP PIXELS FACE AS AN ANIMATED 3D RIG, WEAR IT, OR MAKE IT YOUR PROFILE PICTURE</span>
            </Link>

            <ClientOnly
              fallback={
                <div className="h-[26rem] border border-border font-mono text-[10px] text-muted-foreground">
                  <span className="block p-3">&gt; LOADING SKINS…</span>
                </div>
              }
            >
              <SkinRack value={draft.avatarSkin} onPick={(avatarSkin) => set({ avatarSkin })} />
            </ClientOnly>

            <Picker label="ORIGIN" options={ORIGINS} value={draft.origin} onPick={(origin) => set({ origin })} />
            <Picker label="CALLING" options={CALLINGS} value={draft.calling} onPick={(calling) => set({ calling })} />
            <Picker label="VICE" options={VICES} value={draft.vice} onPick={(vice) => set({ vice })} />
            <Picker label="OATH" options={OATHS} value={draft.oath} onPick={(oath) => set({ oath })} />
          </div>
        </section>

        <aside className="border border-border bg-background/60 backdrop-blur-md">
          <header className="border-b border-border p-5">
            <h2 className="display text-xl">{draft.name.trim() || "UNNAMED"}</h2>
            <p className="label mt-2">{title}</p>
          </header>
          <div className="relative h-96 overflow-hidden border-b border-border">
            <div key={`${draft.avatarModel}-${draft.avatarSkin}`} className="holo-materialize absolute inset-0">
              <CharacterPortrait model={draft.avatarModel} skin={draft.avatarSkin} className="h-full" />
            </div>
            <span className="holo-ring h-10 w-48" style={{ perspective: "600px" }}><i /></span>
            <span className="holo-ring h-6 w-32 opacity-70"><i style={{ animationDirection: "reverse" }} /></span>
            {Array.from({ length: 14 }, (_, i) => (
              <span
                key={i}
                className="holo-spark text-bitcoin"
                style={{ left: `${22 + ((i * 37) % 56)}%`, animationDelay: `${(i * 0.27) % 3.6}s` }}
              />
            ))}
            <span className="holo-scanline" />
          </div>
          <div className="space-y-4 p-5">
            {backstory.split("\n\n").map((paragraph, index) => (
              <p key={index} className="font-mono text-xs leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set({ seed: draft.seed + 1 })}
                className="btn-term inline-flex items-center gap-2"
              >
                <Dices className="size-3.5" aria-hidden="true" /> [ REWRITE ]
              </button>
              <button type="button" onClick={commit} className="btn-term inline-flex items-center gap-2">
                <Save className="size-3.5" aria-hidden="true" /> [ SAVE CHARACTER ]
              </button>
            </div>
            {saved ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bitcoin">
                SAVED — YOUR NAME NOW SHOWS ABOVE YOUR HEAD IN THE OASIS
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/inventory" className="label underline">
                OPEN INVENTORY
              </Link>
              <Link to="/oasis" className="label underline">
                WALK THE OASIS
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
    </div>
  );
}

function Picker({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { id: string; label: string; blurb: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onPick(option.id)}
              className={`border p-3 text-left transition-colors ${
                active ? "border-bitcoin bg-bitcoin/10" : "border-border hover:border-foreground"
              }`}
            >
              <span className="label">{option.label}</span>
              <span className="mt-1 block font-mono text-[10px] leading-relaxed text-muted-foreground">
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
