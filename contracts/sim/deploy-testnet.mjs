import { makeContractDeploy, makeContractCall, broadcastTransaction, fetchNonce, Cl, ClarityVersion, PostConditionMode } from "@stacks/transactions";
import fs from "node:fs";
const key = fs.readFileSync("process.env.DEPLOYER_KEY_FILE", "utf8").trim();
const D = "ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F";
const info = await (await fetch("http://localhost:8080/api/public/stake-pilot")).json();
const step = process.argv[2];
let nonce = await fetchNonce({ address: D, network: "testnet" });
const send = async (tx, label) => { const r = await broadcastTransaction({ transaction: tx, network: "testnet" }); console.log(label, JSON.stringify(r).slice(0, 200)); };
if (step === "deploy") {
  for (const name of ["bw-test-sbtc", "bw-stake-pilot-v1"]) {
    const tx = await makeContractDeploy({ contractName: name, codeBody: fs.readFileSync(`deploy/${name}.clar`, "utf8"), senderKey: key, network: "testnet", clarityVersion: ClarityVersion.Clarity3, nonce: nonce++, fee: 200000n });
    await send(tx, name);
  }
}
if (step === "config") {
  const calls = [
    ["schedule-key", [Cl.bufferFromHex(info.oraclePublicKey)]],
    ["set-pauser", [Cl.principal(info.adminAddress), Cl.bool(true)]],
    ["set-admin", [Cl.principal(info.adminAddress)]],
  ];
  for (const [fn, args] of calls) {
    const tx = await makeContractCall({ contractAddress: D, contractName: "bw-stake-pilot-v1", functionName: fn, functionArgs: args, senderKey: key, network: "testnet", nonce: nonce++, fee: 20000n, postConditionMode: PostConditionMode.Deny });
    await send(tx, fn);
  }
}
