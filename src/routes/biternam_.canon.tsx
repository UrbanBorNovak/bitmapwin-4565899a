import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { CanonScene } from "@/components/biternam/HideoutScenes";
import { CANON_NAMES, resolveCanonVerb, type CanonHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/canon")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.12 · The Canonical Block · Biternam | BITMAPWIN" },
      { name: "description", content: "Wierdamoto's plan lands: bring the recovered Sat 1138 to the honest node and orphan Iman and Will's fork." },
      { property: "og:title", content: "CH.12 · The Canonical Block · Biternam" },
      { property: "og:description", content: "They printed confirmations. You bring work." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<CanonHotspot>
      room="canon" storageKey="biternam.canon.v1" mood="canon" kicker="BITERNAM · CH.12 · THE CANONICAL BLOCK" title="THE CANONICAL BLOCK" item="SAT 1138" hazardText="ZZZAP!"
      names={CANON_NAMES} voice={120} resolve={resolveCanonVerb}
      intro="Iman and Will are printing a fork. Wierdamoto brought the sat. Choose a verb and click."
      script={(s) => ({ id: "npc-wierdamoto-canon", title: "BEDROCK · WIERDAMOTO", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "WIERDAMOTO", mood: "smug", text: "Trace proved the fee. Bait proved the greed. The sat proved the rest.", next: "b" },
        { id: "b", speaker: "DEV9", mood: "idle", text: "(on the wrist-com) Logged in the Marauder file. Closed.", next: "c" },
        { id: "c", speaker: "URBAN", mood: "smug", text: "(on the wrist-com) Told you the blueprint was real. Now let me sleep.", next: null },
      ] : [
        { id: "a", speaker: "WIERDAMOTO", mood: "idle", text: "They have receipts. We have the sat. Take it from my skiff.", next: "b" },
        { id: "b", speaker: "WIERDAMOTO", mood: "smug", text: "Then give it to the node. Don't argue with them. Let the chain do it.", next: null },
      ] })}
      scene={(p) => <CanonScene {...p} />}
    />
  ),
});
