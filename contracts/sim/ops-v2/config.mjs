import { T, Cl, oracleKey, PAUSER, TREASURY, STAKE, send, asAdmin } from "./lib.mjs";
let n = Number(process.argv[2]);
await send(await asAdmin(STAKE, "schedule-key", [Cl.bufferFromHex(T.privateKeyToPublic(oracleKey))], n++), "schedule-key");
await send(await asAdmin(STAKE, "set-pauser", [Cl.principal(PAUSER), Cl.bool(true)], n++), "set-pauser");
await send(await asAdmin(STAKE, "set-funding", [Cl.principal(TREASURY), Cl.uint(50000), Cl.uint(2), Cl.uint(60000), Cl.uint(100000)], n++), "set-funding drill");
