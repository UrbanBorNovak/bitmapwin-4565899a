import { createFileRoute } from "@tanstack/react-router";

/**
 * Server Walker tick, called every minute by the scheduler. It only chains
 * Walker laps the owner already ordered and settles raids from server data;
 * both are idempotent, so extra calls change nothing.
 */
export const Route = createFileRoute("/api/public/guardian-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!request.headers.get("authorization")?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const { walkerTick } = await import("@/lib/guardian-walker.server");
        return Response.json(await walkerTick());
      },
    },
  },
});
