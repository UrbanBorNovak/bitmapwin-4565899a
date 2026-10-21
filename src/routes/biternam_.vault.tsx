import { createFileRoute } from "@tanstack/react-router";
import { HideoutShell } from "@/components/biternam/HideoutShell";
import { VaultScene } from "@/components/biternam/HideoutScenes";
import { VAULT_NAMES, resolveVaultVerb, type VaultHotspot } from "@/lib/hideout-verbs";

export const Route = createFileRoute("/biternam_/vault")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CH.5 · Beneath 1138 · Biternam | BITMAPWIN" },
      { name: "description", content: "Follow Urban's clue under block 1138: audit WILL's forged ledger, open the blueprint vault and face IMAN and WILL." },
      { property: "og:title", content: "CH.5 · Beneath 1138 · Biternam" },
      { property: "og:description", content: "A buried vault, a ghost in chains of receipts and two villains printing fake confirmations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <HideoutShell<VaultHotspot>
      room="vault" storageKey="biternam.vault.v1" mood="vault" kicker="BITERNAM · CH.5 · BENEATH 1138" title="THE 1138 VAULT" item="FORGED LEDGER" hazardText="INK BLAST!"
      names={VAULT_NAMES} voice={60} resolve={resolveVaultVerb}
      intro="Urban's real blueprint is down here. So are two shadows. Choose a verb and click."
      script={(s) => ({ id: "npc-ghost-1138", title: "GHOST OF 1138 · VAULT", start: "a", nodes: s.solved ? [
        { id: "a", speaker: "GHOST", mood: "idle", text: "The audit is done. Sixty forged confirmations, all signed W. I was never orphaned. I was re-routed — by IMAN — and buried under WILL's paper.", next: "b" },
        { id: "b", speaker: "GHOST", mood: "alarm", text: "Their plan: print a fake heavier chain and re-org the whole Oasis onto it. Urban's blueprint is the only honest copy of the bedrock. Take it to dev9.", next: "c" },
        { id: "c", speaker: "IMAN", mood: "glitch", text: "Enjoy your blueprint, Marshal. We already printed the next block.", next: null },
      ] : [
        { id: "a", speaker: "GHOST", mood: "glitch", text: "Four notes... four notes... someone taught me a wrong song. The vault only opens to an honest audit.", next: "b" },
        { id: "b", speaker: "GHOST", mood: "alarm", text: "WILL leaves his ledger lying about. He thinks no one reads. Bring it to the plate. Mind the printer.", next: null },
      ] })}
      scene={(p) => <VaultScene {...p} />}
    />
  ),
});
