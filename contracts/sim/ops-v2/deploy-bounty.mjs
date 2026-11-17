// Deploys BW-BOUNTY-1 to Stacks testnet from the derived testnet admin (key from env only).
import fs from "node:fs";
import { T, adminKey, ADMIN, nonceOf, send } from "./lib.mjs";
const n = await nonceOf(ADMIN);
await send(await T.makeContractDeploy({ contractName: "bw-bounty-v1", codeBody: fs.readFileSync("../../bw-bounty-v1.clar", "utf8"), senderKey: adminKey, network: "testnet", clarityVersion: T.ClarityVersion.Clarity3, nonce: n, fee: 200000n }), `deploy ${ADMIN}.bw-bounty-v1`);
