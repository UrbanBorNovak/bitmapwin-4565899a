import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { LairScene } from "@/components/biternam/HideoutScenes";
import { LAIR_NAMES, resolveLairVerb, type LairHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/lair")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.6 · The Re-Org Lair · Biternam | BITMAPWIN" },
      { name: "description", content: "Take the fight to IMAN and WILL: retarget their rogue rig with Urban's blueprint and pull the siphon breaker with the ghost of 1138." },
      { property: "og:title", content: "CH.6 · The Re-Org Lair · Biternam" },
      { property: "og:description", content: "Overclocked stolen hash, a fake heavier chain and one breaker between the Oasis and a re-org." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<LairHotspot>
      room="lair" storageKey="biternam.lair.v1" mood="lair" kicker="BITERNAM · CH.6 · THE RE-ORG LAIR" title="IMAN & WILL'S LAIR" item="BREAKER HANDLE" hazardText="ZAP!"
      names={LAIR_NAMES} voice={70} resolve={resolveLairVerb}
      intro="Their rig mines a fake heavier chain. You carry Urban's real blueprint. Choose a verb and click."
      script={(s) => ({ id: "npc-iman-lair", title: "RE-ORG LAIR · SHOWDOWN", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "IMAN", mood: "alarm", text: "The siphon... cold. Sixty blocks of work, and you pulled it with a ghost.", next: "b" },
        { id: "b", speaker: "WILL", mood: "glitch", text: "Fine. FINE. But the Void has a basement, Marshal. And we printed the map.", next: "c" },
        { id: "c", speaker: "GHOST", mood: "idle", text: "Block 1138, confirmed. Tell dev9 the log is complete. For now.", next: null },
      ] : [
        { id: "a", speaker: "IMAN", mood: "smug", text: "Welcome to the real tip, Marshal. Ours is heavier. Heavier wins.", next: "b" },
        { id: "b", speaker: "WILL", mood: "idle", text: "One breaker, one handle, and I hid the handle somewhere very clever. Don't look at the console.", next: "c" },
        { id: "c", speaker: "IMAN", mood: "alarm", text: "WILL. You told him.", next: null },
      ] })}
      scene={(p) => <LairScene {...p} />}
    />
  ),
});
