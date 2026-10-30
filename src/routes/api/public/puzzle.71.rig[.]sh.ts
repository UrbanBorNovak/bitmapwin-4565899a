import { createFileRoute } from "@tanstack/react-router";
import { BASH_RIG } from "@/lib/rig-kit";

export const Route = createFileRoute("/api/public/puzzle/71/rig.sh")({
  server: {
    handlers: {
      GET: async () => new Response(BASH_RIG, { headers: { "content-type": "text/x-shellscript; charset=utf-8", "access-control-allow-origin": "*" } }),
    },
  },
});
