import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { HandshakeScene } from "@/components/biternam/HideoutScenes";
import { HANDSHAKE_NAMES, resolveHandshakeVerb, type HandshakeHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/handshake")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.10 · The Handshake · Biternam | BITMAPWIN" },
      { name: "description", content: "Trace the third address with Invest Geek and bring Wierdamoto and Bitoshi back to the same table." },
      { property: "og:title", content: "CH.10 · The Handshake · Biternam" },
      { property: "og:description", content: "The mask and the cook were both framed. One printout, one neutral table, one handshake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<HandshakeHotspot>
      room="handshake" storageKey="biternam.handshake.v1" mood="handshake" kicker="BITERNAM · CH.10 · THE HANDSHAKE" title="THE NEUTRAL TABLE" item="THE TRACE" hazardText="FIZZ!"
      names={HANDSHAKE_NAMES} voice={200} resolve={resolveHandshakeVerb}
      intro="The mask and the cook, one table, zero eye contact. Invest Geek has the numbers. Choose a verb and click."
      script={(s) => ({ id: "npc-geek-handshake", title: "NEUTRAL TABLE · INVEST GEEK", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "INVEST GEEK", mood: "smug", text: "Look at that. Two rows, one column: FRIENDS AGAIN. Best chart I've ever made.", next: "b" },
        { id: "b", speaker: "WIERDAMOTO", mood: "idle", text: "The fee came from IMAN's pattern. He split us up so nobody would check the change address together.", next: "c" },
        { id: "c", speaker: "BITOSHI", mood: "smug", text: "Then we check together now. Mask, bring your skiff. I'll bring the flask.", next: "d" },
        { id: "d", speaker: "ASTRAL", mood: "idle", text: "(on the wrist-com) The Night of Two Signatures exhibit is open. Proof on the wall, not rumours.", next: null },
      ] : [
        { id: "a", speaker: "INVEST GEEK", mood: "smug", text: "Row 1138. Wierdamoto paid the input. Bitoshi got the change. The fee? Neither of them.", next: "b" },
        { id: "b", speaker: "INVEST GEEK", mood: "idle", text: "Print the trace and put it on the table. They won't believe each other. They'll believe the chain.", next: null },
      ] })}
      scene={(p) => <HandshakeScene {...p} />}
    />
  ),
});
