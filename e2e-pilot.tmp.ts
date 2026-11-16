import { randomPrivateKey, privateKeyToAddress, makeContractCall, broadcastTransaction, fetchNonce, fetchCallReadOnlyFunction, cvToJSON, Cl, PostConditionMode } from "@stacks/transactions";
import fs from "node:fs";
import { signAttestation, testnetBurnHeight, PILOT_ORACLE_EPOCH } from "./src/lib/stacks-pilot.server";
import { attestationHash, PILOT_DEPLOYER } from "./src/lib/stacks-pilot";
const F = "/tmp/clar/holder.key";
let key: string; try { key = fs.readFileSync(F, "utf8").trim(); } catch { key = randomPrivateKey(); fs.writeFileSync(F, key); }
const me = privateKeyToAddress(key, "testnet");
const step = process.argv[2];
const H = 2_000_000; // non-existent BITMAP, used only to exercise the contract
const ro = async (c: string, fn: string, args: any[]) => cvToJSON(await fetchCallReadOnlyFunction({ contractAddress: PILOT_DEPLOYER, contractName: c, functionName: fn, functionArgs: args, senderAddress: me, network: "testnet" }));
const call = async (c: string, fn: string, args: any[], nonce: bigint) => {
  const tx = await makeContractCall({ contractAddress: PILOT_DEPLOYER, contractName: c, functionName: fn, functionArgs: args, senderKey: key, network: "testnet", nonce, fee: 20000n, postConditionMode: PostConditionMode.Allow });
  const r: any = await broadcastTransaction({ transaction: tx, network: "testnet" }); console.log(fn, r.txid ?? JSON.stringify(r).slice(0, 200));
};
console.log("holder", me);
if (step === "faucet") console.log(await (await fetch(`https://api.testnet.hiro.so/extended/v1/faucets/stx?address=${me}`, { method: "POST" })).text().then((t) => t.slice(0, 60)));
if (step === "stake") {
  const issued = await testnetBurnHeight();
  const att = { epoch: PILOT_ORACLE_EPOCH, height: H, owner: me, weight: 100, issued };
  const onchain = await ro("bw-stake-pilot-v1", "attestation-hash", [Cl.uint(att.epoch), Cl.uint(H), Cl.principal(me), Cl.uint(100), Cl.uint(issued)]);
  console.log("hash match:", String(onchain.value).replace(/^0x/, "") === attestationHash(att));
  let n = await fetchNonce({ address: me, network: "testnet" });
  await call("bw-stake-pilot-v1", "attest", [Cl.uint(att.epoch), Cl.uint(H), Cl.uint(100), Cl.uint(issued), Cl.bufferFromHex(signAttestation(att))], n++);
  await call("bw-test-sbtc", "mint", [Cl.uint(100000), Cl.principal(me)], n++);
}
if (step === "fund") { const n = await fetchNonce({ address: me, network: "testnet" }); await call("bw-stake-pilot-v1", "fund", [Cl.uint(50000)], n); }
if (step === "claim") { const n = await fetchNonce({ address: me, network: "testnet" }); await call("bw-stake-pilot-v1", "claim", [Cl.uint(H)], n); }
if (step === "forged") {
  const issued = await testnetBurnHeight();
  const att = { epoch: 1, height: H + 1, owner: me, weight: 100, issued };
  const bad = signAttestation({ ...att, weight: 200 }); // signature for a different weight
  const n = await fetchNonce({ address: me, network: "testnet" });
  await call("bw-stake-pilot-v1", "attest", [Cl.uint(1), Cl.uint(H + 1), Cl.uint(100), Cl.uint(issued), Cl.bufferFromHex(bad)], n);
}
if (step === "read") {
  console.log("stake", JSON.stringify((await ro("bw-stake-pilot-v1", "get-stake", [Cl.uint(H)])).value?.value ? "present" : "none"));
  console.log("pending", (await ro("bw-stake-pilot-v1", "pending", [Cl.uint(H)])).value);
  console.log("balance", (await ro("bw-test-sbtc", "get-balance", [Cl.principal(me)])).value?.value);
  console.log("status", JSON.stringify((await ro("bw-stake-pilot-v1", "status", [])).value));
}
