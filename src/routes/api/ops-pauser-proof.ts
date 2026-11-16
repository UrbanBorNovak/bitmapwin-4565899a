// TEMPORARY dev-only ops route for the pause-key drill. Deleted after use.
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/ops-pauser-proof")({
  server: { handlers: { POST: async () => {
    if (!import.meta.env.DEV) return new Response("not found", { status: 404 });
    const { makeContractCall, broadcastTransaction, fetchNonce, Cl, PostConditionMode, privateKeyToAddress, privateKeyToPublic, randomPrivateKey } = await import("@stacks/transactions");
    const { sha256 } = await import("@noble/hashes/sha2.js");
    const { bytesToHex, utf8ToBytes } = await import("@noble/hashes/utils.js");
    const key = bytesToHex(sha256(utf8ToBytes(`BW-STACKS-1/testnet/pauser|${process.env.STACKS_PILOT_PAUSER_SEED}`))) + "01";
    const me = privateKeyToAddress(key, "testnet");
    const pub = Cl.bufferFromHex(privateKeyToPublic(randomPrivateKey()) as string);
    let nonce = await fetchNonce({ address: me, network: "testnet" });
    const calls: [string, any[]][] = [
      ["pause", []],
      ["unpause", []],
      ["set-admin", [Cl.principal(me)]],
      ["set-pauser", [Cl.principal("ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F"), Cl.bool(true)]],
      ["set-rate-cap", [Cl.uint(1)]],
      ["schedule-key", [pub]],
      ["revoke-epoch", [Cl.uint(1), Cl.uint(0)]],
      ["emergency-key", [pub, Cl.uint(0)]],
    ];
    const out: Record<string, string> = { sender: me };
    for (const [fn, args] of calls) {
      const tx = await makeContractCall({ contractAddress: "ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F", contractName: "bw-stake-pilot-v1", functionName: fn, functionArgs: args, senderKey: key, network: "testnet", nonce: nonce++, fee: 30000n, postConditionMode: PostConditionMode.Deny });
      const r = (await broadcastTransaction({ transaction: tx, network: "testnet" })) as any;
      out[fn] = r.txid ?? JSON.stringify(r);
    }
    return Response.json(out);
  } } },
});
