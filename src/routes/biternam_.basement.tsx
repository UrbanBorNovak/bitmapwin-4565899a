import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { BasementScene } from "@/components/biternam/HideoutScenes";
import { BASEMENT_NAMES, resolveBasementVerb, type BasementHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/basement")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.7 · The Void Basement · Biternam | BITMAPWIN" },
      { name: "description", content: "WILL said the Void has a basement. Find his printed map, hold it to the Bedrock Monument and expose the counterfeit BITMAP mint." },
      { property: "og:title", content: "CH.7 · The Void Basement · Biternam" },
      { property: "og:description", content: "Under the Void: a press stamping fake copies of 1138.bitmap, and the one bedrock it can't fool." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<BasementHotspot>
      room="basement" storageKey="biternam.basement.v1" mood="basement" kicker="BITERNAM · CH.7 · THE VOID BASEMENT" title="BELOW THE VOID" item="WILL'S PRINTED MAP" hazardText="WHOOSH!"
      names={BASEMENT_NAMES} voice={60} resolve={resolveBasementVerb}
      intro="WILL wasn't bluffing. Something down here is printing copies. Choose a verb and click."
      script={(s) => ({ id: "npc-ghost-basement", title: "GHOST OF 1138 · BASEMENT", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "GHOST", mood: "idle", text: "Every copy failed the bedrock. A copy can look like a BITMAP. It can't be one.", next: "b" },
        { id: "b", speaker: "WILL", mood: "alarm", text: "(over a cracked speaker) My mint! Do you know how long it took to make 1138 look... almost right?", next: "c" },
        { id: "c", speaker: "IMAN", mood: "glitch", text: "Leave it, WILL. The map was only the first page. The Marshal hasn't seen the rest.", next: null },
      ] : [
        { id: "a", speaker: "GHOST", mood: "glitch", text: "That press is printing me. Over and over. Each copy a little wrong.", next: "b" },
        { id: "b", speaker: "GHOST", mood: "alarm", text: "WILL drew his own Oasis on that table. Hold it up to the bedrock. The bedrock never lies.", next: null },
      ] })}
      scene={(p) => <BasementScene {...p} />}
    />
  ),
});
