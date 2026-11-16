import fs from "node:fs";
import { T, Cl, adminKey, oracleKey, ADMIN, PAUSER, TREASURY, STAKE, TOKEN, nonceOf, send, asAdmin } from "./lib.mjs";
let n = await nonceOf(ADMIN);
await send(await T.makeContractDeploy({ contractName: "bw-stake-pilot-v2", codeBody: fs.readFileSync("v2.clar", "utf8"), senderKey: adminKey, network: "testnet", clarityVersion: T.ClarityVersion.Clarity3, nonce: n++, fee: 300000n }), "deploy");
await send(await asAdmin(STAKE, "schedule-key", [Cl.bufferFromHex(T.privateKeyToPublic(oracleKey))], n++), "schedule-key");
await send(await asAdmin(STAKE, "set-pauser", [Cl.principal(PAUSER), Cl.bool(true)], n++), "set-pauser");
// Drill settings: 2-burn-block periods so rollover is visible quickly.
await send(await asAdmin(STAKE, "set-funding", [Cl.principal(TREASURY), Cl.uint(50000), Cl.uint(2), Cl.uint(60000), Cl.uint(100000)], n++), "set-funding drill");
await send(await T.makeSTXTokenTransfer({ recipient: TREASURY, amount: 20_000_000n, senderKey: adminKey, network: "testnet", nonce: n++, fee: 10000n }), "stx to treasury");
await send(await asAdmin(TOKEN, "mint", [Cl.uint(1000000), Cl.principal(TREASURY)], n++), "mint treasury");
await send(await asAdmin(TOKEN, "mint", [Cl.uint(100000), Cl.principal(ADMIN)], n++), "mint admin");
