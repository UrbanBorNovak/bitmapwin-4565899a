import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { HoldersScene } from "@/components/biternam/HideoutScenes";
import { HOLDERS_NAMES, resolveHoldersVerb, type HoldersHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/holders")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.9 · Page Three · Biternam | BITMAPWIN" },
      { name: "description", content: "Page three is about the holders. Take WILL's forged holder list to the Ownership Mirror, which only trusts keys." },
      { property: "og:title", content: "CH.9 · Page Three · Biternam" },
      { property: "og:description", content: "A forgery parlour of drawn signatures and paper wallets, and one mirror that shows only what keys can move." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<HoldersHotspot>
      room="holders" storageKey="biternam.holders.v1" mood="holders" kicker="BITERNAM · CH.9 · PAGE THREE" title="THE FORGERY PARLOUR" item="PAGE THREE" hazardText="POP!"
      names={HOLDERS_NAMES} voice={60} resolve={resolveHoldersVerb}
      intro="WILL is signing other people's names. Lots of them. Choose a verb and click."
      script={(s) => ({ id: "npc-will-holders", title: "FORGERY PARLOUR · WILL", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "WILL", mood: "alarm", text: "Blank! The whole page, blank! Do you know how hard it is to forge a squiggle?", next: "b" },
        { id: "b", speaker: "GHOST", mood: "idle", text: "Squiggles don't sign transactions, WILL. Keys do. Every holder is still the holder.", next: "c" },
        { id: "c", speaker: "IMAN", mood: "glitch", text: "(from the dark) Then we stop forging keys, WILL. We go find where people keep them.", next: null },
      ] : [
        { id: "a", speaker: "WILL", mood: "smug", text: "Page three, Marshal. Every holder of every BITMAP we copied. Signed. By me. On their behalf.", next: "b" },
        { id: "b", speaker: "WILL", mood: "idle", text: "Don't look in the mirror. It's rude. It keeps asking for keys.", next: null },
      ] })}
      scene={(p) => <HoldersScene {...p} />}
    />
  ),
});
