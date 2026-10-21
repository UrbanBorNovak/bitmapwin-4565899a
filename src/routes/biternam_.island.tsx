import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { IslandScene } from "@/components/biternam/HideoutScenes";
import { ISLAND_NAMES, resolveIslandVerb, type IslandHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/island")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Urban's Island Hotel · Biternam | BITMAPWIN" },
      { name: "description", content: "An offshore atoll with twin palms, a tiki bar and Urban asleep on the Hangover Bed after laying the bedrock." },
      { property: "og:title", content: "Urban's Island Hotel · Biternam" },
      { property: "og:description", content: "Shake the palms, cure Urban's hangover, hear where the blueprint is hidden." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<IslandHotspot>
      room="island" storageKey="biternam.island.v1" mood="island" kicker="BITERNAM · OFFSHORE ATOLL" title="URBAN'S ISLAND HOTEL" item="COCONUT" hazardText="OUCH!"
      names={ISLAND_NAMES} voice={200} resolve={resolveIslandVerb}
      intro="Choose a verb, then click something on the island. Urban is not awake yet."
      script={(s) => ({ id: "npc-urban-island", title: "URBAN · HANGOVER BED", start: "a", nodes: [
        { id: "a", speaker: "URBAN", mood: s.solved ? "smug" : "idle", text: s.solved
          ? "Ahh. Coconut. Okay. I laid every tile of the bedrock in one night. Then I celebrated. Hard."
          : "Mmmh... too many tiles... the Hilbert curve is spinning... get me something from those palms...", next: s.solved ? "b" : null },
        { id: "b", speaker: "URBAN", mood: "alarm", text: "The blueprint behind my rig? Decoy. The real one is under block 1138. The ghost is guarding it. Tell dev9: the re-route came from inside the Void.", next: null },
      ] })}
      scene={(p) => <IslandScene {...p} />}
    />
  ),
});
