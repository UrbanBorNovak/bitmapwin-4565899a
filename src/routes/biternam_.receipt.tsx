import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { ReceiptScene } from "@/components/biternam/HideoutScenes";
import { RECEIPT_NAMES, resolveReceiptVerb, type ReceiptHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/receipt")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.13 · The Marshal's Receipt · Biternam | BITMAPWIN" },
      { name: "description", content: "Part 2 begins: Mr. Gold, the Ledger Collector, lays an old receipt with Wierdamoto's signature on the Trading Post counter." },
      { property: "og:title", content: "CH.13 · The Marshal's Receipt · Biternam" },
      { property: "og:description", content: "A debt does not disappear when a record is closed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<ReceiptHotspot>
      room="receipt" storageKey="biternam.receipt.v1" mood="receipt" kicker="BITERNAM · PART 2 · CH.13 · THE MARSHAL'S RECEIPT" title="THE MARSHAL'S RECEIPT" item="OLD RECEIPT" hazardText="CLANG!"
      names={RECEIPT_NAMES} voice={110} resolve={resolveReceiptVerb}
      intro="After hours at the Trading Post. Mr. Gold has left something on the counter. Choose a verb and click."
      script={(s) => ({ id: "npc-gold-receipt", title: "TRADING POST · MR. GOLD", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "MR. GOLD", mood: "idle", text: "UNPAID: ONE MEMORY. BENEFICIARY: THE DARKSIDE. Your signature, Marshal.", next: "b" },
        { id: "b", speaker: "WIERDAMOTO", mood: "idle", text: "I told you the truth about 1138. I did not tell you whose name was on the first receipt.", next: null },
      ] : [
        { id: "a", speaker: "MR. GOLD", mood: "smug", text: "Congratulations, Marshal. You saved the record you could see.", next: "b" },
        { id: "b", speaker: "WIERDAMOTO", mood: "idle", text: "Gold. That archive was closed.", next: "c" },
        { id: "c", speaker: "MR. GOLD", mood: "idle", text: "No. It was deferred. The slip is on the counter.", next: null },
      ] })}
      scene={(p) => <ReceiptScene {...p} />}
    />
  ),
});
