import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { BitchatChannel } from "@/components/game/BitchatChannel";
export const Route = createFileRoute("/zz-bitchat-check")({ component: () => <div className="w-96 border border-border" id="bc"><ClientOnly><BitchatChannel /></ClientOnly></div> });
