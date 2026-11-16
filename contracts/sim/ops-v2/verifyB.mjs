import { Cl, TREASURY, STAKE, nonceOf, send, asTreasury } from "./lib.mjs";
let t = await nonceOf(TREASURY);
await send(await asTreasury(STAKE, "fund", [Cl.uint(40001)], t++), "B1 new period, pool would hold 100,001 (expect u411)");
await send(await asTreasury(STAKE, "fund", [Cl.uint(40000)], t++), "B2 new period, pool exactly 100,000 (expect ok)");
await send(await asTreasury(STAKE, "fund", [Cl.uint(1)], t++), "B3 pool full, period has room (expect u411)");
