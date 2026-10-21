import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { BatcaveScene } from "@/components/biternam/HideoutScenes";
import { BATCAVE_NAMES, resolveBatcaveVerb, type BatcaveHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/batcave")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "dev9's Batcave · Biternam | BITMAPWIN" },
      { name: "description", content: "The Marauder's cave under the Oasis: twelve CRTs, a liquid-cooled ASIC rack and the sealed MARAUDER LOG." },
      { property: "og:title", content: "dev9's Batcave · Biternam" },
      { property: "og:description", content: "Find the cold fuse, wake the Bat-computer, read the MARAUDER LOG with dev9." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<BatcaveHotspot>
      room="batcave" storageKey="biternam.batcave.v1" mood="batcave" kicker="BITERNAM · BEDROCK -9" title="DEV9'S BATCAVE" item="COLD FUSE" hazardText="SCREEECH!"
      names={BATCAVE_NAMES} voice={150} resolve={resolveBatcaveVerb}
      intro="Choose a verb, then click something in the cave. dev9 is watching the screens."
      script={(s) => ({ id: "npc-dev9-cave", title: "DEV9 · THE MARAUDER", start: "a", nodes: [
        { id: "a", speaker: "DEV9", mood: s.solved ? "smug" : "alarm", text: s.solved
          ? "The MARAUDER LOG. Every block since 1138. Tornado calls them Turdinals. I call them evidence."
          : "I gave Dabber the booth. Up there they talk. Down here the chain talks. The Bat-computer is dark. Find me a cold fuse.", next: "b" },
        { id: "b", speaker: "DEV9", mood: "idle", text: s.solved
          ? "The ghost of 1138 wasn't orphaned by accident. Someone re-routed it. Urban knows who. He's on his island, sleeping it off."
          : "The ASIC rack keeps a spare. Don't wake the bats. They each hold one sat and they hold a grudge.", next: null },
      ] })}
      scene={(p) => <BatcaveScene {...p} />}
    />
  ),
});
