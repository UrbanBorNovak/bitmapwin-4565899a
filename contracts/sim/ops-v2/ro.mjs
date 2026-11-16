import { ro, STAKE, H } from "./lib.mjs";
const f = (await ro("funding")).value; console.log(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value])));
const b = await (await fetch(`${H}/extended/v1/address/${STAKE}/balances`)).json();
console.log("balance", JSON.stringify(b.fungible_tokens));
console.log("status", JSON.stringify((await ro("status")).value));
