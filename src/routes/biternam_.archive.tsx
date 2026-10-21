import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { ArchiveScene } from "@/components/biternam/HideoutScenes";
import { ARCHIVE_NAMES, resolveArchiveVerb, type ArchiveHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/archive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.8 · The Missing Pages · Biternam | BITMAPWIN" },
      { name: "description", content: "IMAN said the map was only the first page. Pull page two from his shredder and verify it on the honest chain reader." },
      { property: "og:title", content: "CH.8 · The Missing Pages · Biternam" },
      { property: "og:description", content: "A shredder archive, a blizzard of receipts and the one screen that only shows what the chain proves." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<ArchiveHotspot>
      room="archive" storageKey="biternam.archive.v1" mood="archive" kicker="BITERNAM · CH.8 · THE MISSING PAGES" title="THE SHREDDER ARCHIVE" item="PAGE TWO" hazardText="FLUTTER!"
      names={ARCHIVE_NAMES} voice={70} resolve={resolveArchiveVerb}
      intro="IMAN is shredding the rest of the map. Get a page before it's confetti. Choose a verb and click."
      script={(s) => ({ id: "npc-iman-archive", title: "SHREDDER ARCHIVE · IMAN", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "IMAN", mood: "alarm", text: "Every height on that page checks out. Of course it does. We only copy the real ones.", next: "b" },
        { id: "b", speaker: "GHOST", mood: "idle", text: "A list of targets is just a list, IMAN. The chain still says who holds them.", next: "c" },
        { id: "c", speaker: "IMAN", mood: "glitch", text: "Then we'll stop copying, Marshal. Page three is about the holders.", next: null },
      ] : [
        { id: "a", speaker: "IMAN", mood: "smug", text: "Page one was a map. Page two is a shopping list. You won't read it. Nobody reads shreds.", next: "b" },
        { id: "b", speaker: "IMAN", mood: "idle", text: "Stay away from the fan. And the reader. The reader is... annoyingly honest.", next: null },
      ] })}
      scene={(p) => <ArchiveScene {...p} />}
    />
  ),
});
