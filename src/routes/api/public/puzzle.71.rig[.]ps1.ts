import { createFileRoute } from "@tanstack/react-router";
import { PS_RIG } from "@/lib/rig-kit";

export const Route = createFileRoute("/api/public/puzzle/71/rig.ps1")({
  server: {
    handlers: {
      GET: async () => new Response(PS_RIG, { headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" } }),
    },
  },
});
