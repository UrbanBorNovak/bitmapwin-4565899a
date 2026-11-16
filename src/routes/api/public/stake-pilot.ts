import { createFileRoute } from "@tanstack/react-router";

// Public keys of the testnet soft-stake pilot, so anyone can check the contract
// was configured with them. Contains no secrets and writes nothing.
export const Route = createFileRoute("/api/public/stake-pilot")({
  server: {
    handlers: {
      GET: async () => {
        const { pilotPublicInfo, PILOT_ORACLE_EPOCH } = await import("@/lib/stacks-pilot.server");
        const { PILOT_STAKE, PILOT_TOKEN } = await import("@/lib/stacks-pilot");
        try {
          return Response.json({ ...pilotPublicInfo(), epoch: PILOT_ORACLE_EPOCH, stakeContract: PILOT_STAKE, tokenContract: PILOT_TOKEN, mainnetRewards: false });
        } catch {
          return Response.json({ error: "pilot not configured" }, { status: 503 });
        }
      },
    },
  },
});
