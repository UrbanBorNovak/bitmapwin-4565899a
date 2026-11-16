import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/stake-pilot")({
  beforeLoad: () => { throw redirect({ to: "/soft-stake", statusCode: 301 }); },
  head: () => ({
    meta: [
      { title: "Soft-stake pilot (testnet) · BitmapWIN" },
      { name: "description", content: "Redirects to the BITMAP soft-stake pilot on Stacks testnet." },
      { property: "og:title", content: "BITMAP soft-stake pilot · Stacks testnet" },
      { property: "og:description", content: "Keep your BITMAP in your wallet and claim test tokens on Stacks testnet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
