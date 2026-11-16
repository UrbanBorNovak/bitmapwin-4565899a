import { Cl, ADMIN, TREASURY, STAKE, nonceOf, send, asAdmin } from "./lib.mjs";
await send(await asAdmin(STAKE, "set-funding", [Cl.principal(TREASURY), Cl.uint(50000), Cl.uint(144), Cl.uint(100000), Cl.uint(250000)], await nonceOf(ADMIN)), "set-funding pilot");
