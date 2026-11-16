// Read a holder's stake, claimable amount, token balance and the pool books.
// Usage: bun check-holder.mjs <bitmap-height> [stacks-address]
import { Cl, H, STAKE, TOKEN, ro } from "./lib.mjs";
const h = Number(process.argv[2]);
const s = await ro("get-stake", [Cl.uint(h)]);
console.log("stake", JSON.stringify(s.value?.value ?? null));
console.log("pending", (await ro("pending", [Cl.uint(h)])).value);
const who = process.argv[3] ?? s.value?.value?.owner?.value;
if (who) {
  const b = await (await fetch(`${H}/extended/v1/address/${who}/balances`)).json();
  console.log("holder", who, "test tokens", b.fungible_tokens?.[`${TOKEN}::tsbtc`]?.balance ?? "0", "STX", b.stx?.balance);
}
const f = (await ro("funding")).value;
console.log("pool-held", f["pool-held"].value, "funded-total", f["funded-total"].value, "this-period", f["funded-this-period"].value);
console.log("status", JSON.stringify(Object.fromEntries(Object.entries((await ro("status")).value).map(([k, v]) => [k, v.value]))));
const pb = await (await fetch(`${H}/extended/v1/address/${STAKE}/balances`)).json();
console.log("pool balance", pb.fungible_tokens?.[`${TOKEN}::tsbtc`]?.balance ?? "0");
const info = await (await fetch(`${H}/v2/info`)).json();
console.log("burn height now", info.burn_block_height);
