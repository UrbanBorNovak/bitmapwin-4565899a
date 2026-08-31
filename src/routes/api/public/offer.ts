import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/offer — body is a base64 encoded PSBT (raw, `--data-binary`),
 * mirroring `POST /offer` on an ord server. The offer is validated against the
 * live UTXO set before it is accepted.
 */
export const Route = createFileRoute("/api/public/offer")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type, accept",
          },
        }),
      POST: async ({ request }) => {
        const cors = { "access-control-allow-origin": "*" };
        const raw = (await request.text()).trim();
        if (raw.length < 40 || raw.length > 400_000 || !/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
          return Response.json(
            { error: "Body must be a base64 encoded PSBT" },
            { status: 400, headers: cors },
          );
        }
        try {
          const { submitOffer } = await import("@/lib/offers.server");
          const offer = await submitOffer(raw);
          return Response.json(offer, { status: offer.duplicate ? 200 : 201, headers: cors });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Offer rejected" },
            { status: 422, headers: cors },
          );
        }
      },
    },
  },
});
