import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { FortressScene } from "@/components/biternam/HideoutScenes";
import { FORTRESS_NAMES, resolveFortressVerb, type FortressHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/fortress")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.11 · The Key Fortress · Biternam | BITMAPWIN" },
      { name: "description", content: "Feed Limitless a bait key, outwit The Joker and free Sat 1138 from the Key Fortress." },
      { property: "og:title", content: "CH.11 · The Key Fortress · Biternam" },
      { property: "og:description", content: "One bait key, one greedy scanner, one freed sat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<FortressHotspot>
      room="fortress" storageKey="biternam.fortress.v1" mood="fortress" kicker="BITERNAM · CH.11 · THE KEY FORTRESS" title="THE KEY FORTRESS" item="THE BAIT KEY" hazardText="HONK!"
      names={FORTRESS_NAMES} voice={85} resolve={resolveFortressVerb}
      intro="Limitless guards Sat 1138 behind a key scanner. The Joker guards the jokes. Bitoshi left you a crate. Choose a verb and click."
      script={(s) => ({ id: "npc-ghost-fortress", title: "KEY FORTRESS · GHOST OF 1138", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "GHOST OF 1138", mood: "smug", text: "My sat is free. Limitless is still staring into that mirror.", next: "b" },
        { id: "b", speaker: "BITOSHI", mood: "smug", text: "Told you. Zero sats, full flavour.", next: "c" },
        { id: "c", speaker: "WIERDAMOTO", mood: "idle", text: "Limitless and the clown were the guards. Iman and Will are the ones who built the cage. We go to them next.", next: null },
      ] : [
        { id: "a", speaker: "GHOST OF 1138", mood: "idle", text: "That cage holds my sat. Limitless only opens it for a key he wants.", next: "b" },
        { id: "b", speaker: "BITOSHI", mood: "smug", text: "(on the wrist-com) The crate. Bait key. Looks like a whale, holds nothing. Feed it to the scanner.", next: null },
      ] })}
      scene={(p) => <FortressScene {...p} />}
    />
  ),
});
