// Treasury top-up after a real holder has staked: the whole top-up (plus anything
// stranded while nobody was staked) is shared across current stakers by weight.
// Usage: bun fund-holder.mjs <amount>
import { T, Cl, H, STAKE, TOKEN, TREASURY, asTreasury, call, tKeys, send, nonceOf, ro } from "./lib.mjs";
const amount = BigInt(process.argv[2] ?? "50000");
const st = (await ro("status")).value;
if (st["total-weight"].value === "0") { console.log("Nobody is staked yet: funding now would only add to stranded. Stake first."); process.exit(1); }
const bal = await (await fetch(`${H}/extended/v1/address/${TREASURY}/balances`)).json();
const tok = BigInt(bal.fungible_tokens?.[`${TOKEN}::tsbtc`]?.balance ?? "0");
console.log("treasury STX", bal.stx.balance, "test tokens", tok.toString());
let n = await nonceOf(TREASURY);
if (tok < amount) {
  const mint = await asTreasury(TOKEN, "mint", [Cl.uint(amount - tok), Cl.principal(TREASURY)], n++);
  await send(mint, "treasury mint");
}
await send(await asTreasury(STAKE, "fund", [Cl.uint(amount)], n++), `fund ${amount}`);
