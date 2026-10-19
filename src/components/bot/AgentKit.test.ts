import { describe, expect, it } from "vitest";
import { agentScript, AGENT_WALLET_ARGS } from "./AgentKit";

describe("exported watch agent", () => {
  const src = agentScript(500_000, 840_000);

  it("runs only the read-only balance wallet command", () => {
    expect(AGENT_WALLET_ARGS).toEqual(["bitcoin", "balance", "--json"]);
    expect(src.match(/execFileSync\(/g)?.length).toBe(1);
  });

  it("contains no signing, sending, buying or broadcasting calls", () => {
    for (const bad of [" send", "--yes", "broadcast(", "buy/prepare", "buy/broadcast", "psbt", "sign(", "swap ", "method: \"POST\""]) {
      expect(src.toLowerCase()).not.toContain(bad.toLowerCase());
    }
  });

  it("bakes the user's rule limits into the file", () => {
    expect(src).toContain("const MAX_SATS = 500000;");
    expect(src).toContain("const MAX_HEIGHT = 840000;");
  });
});
