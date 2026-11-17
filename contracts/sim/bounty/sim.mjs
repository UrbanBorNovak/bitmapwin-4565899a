// BW-BOUNTY-1 simnet scenarios. Run from this folder: node sim.mjs
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { Cl } from "@stacks/transactions";
import assert from "node:assert/strict";
const s = await initSimnet("./Clarinet.toml");
const a = s.getAccounts(); const D = a.get("deployer"), P = a.get("wallet_1"), B1 = a.get("wallet_2"), B2 = a.get("wallet_3");
const call = (fn, args, who) => s.callPublicFn("bounty", fn, args, who).result;
const bal = (w) => Number(s.callReadOnlyFn("tok", "get-balance", [Cl.principal(w)], D).result.value.value);
const ok = (n, f) => { f(); console.log("✓", n); };
s.callPublicFn("tok", "mint", [Cl.uint(100000), Cl.principal(P)], P);
const create = (amt = 25000, blocks = 10) => call("create-bounty", [Cl.uint(521066), Cl.uint(amt), Cl.stringUtf8("Tower"), Cl.uint(blocks)], P);
ok("rejects tiny amount and bad window", () => { assert.deepEqual(create(10), Cl.error(Cl.uint(100))); assert.deepEqual(create(25000, 1), Cl.error(Cl.uint(101))); });
ok("create escrows tokens", () => { assert.deepEqual(create(), Cl.ok(Cl.uint(1))); assert.equal(bal(P), 75000); assert.equal(bal(`${D}.bounty`), 25000); });
ok("poster cannot submit to own bounty", () => assert.deepEqual(call("submit-work", [Cl.uint(1), Cl.stringAscii("abci0")], P), Cl.error(Cl.uint(108))));
ok("accept needs a submission", () => assert.deepEqual(call("accept-and-pay", [Cl.uint(1), Cl.principal(B1)], P), Cl.error(Cl.uint(107))));
ok("builders submit", () => { assert.deepEqual(call("submit-work", [Cl.uint(1), Cl.stringAscii("abci0")], B1), Cl.ok(Cl.bool(true))); call("submit-work", [Cl.uint(1), Cl.stringAscii("defi0")], B2); });
ok("only poster can accept", () => assert.deepEqual(call("accept-and-pay", [Cl.uint(1), Cl.principal(B1)], B2), Cl.error(Cl.uint(103))));
ok("refund refused before deadline", () => assert.deepEqual(call("cancel-and-refund", [Cl.uint(1)], P), Cl.error(Cl.uint(106))));
ok("accept pays the chosen builder in full", () => { assert.deepEqual(call("accept-and-pay", [Cl.uint(1), Cl.principal(B2)], P), Cl.ok(Cl.bool(true))); assert.equal(bal(B2), 25000); assert.equal(bal(`${D}.bounty`), 0); });
ok("paid bounty cannot pay twice or refund", () => { assert.deepEqual(call("accept-and-pay", [Cl.uint(1), Cl.principal(B1)], P), Cl.error(Cl.uint(104))); });
ok("expired bounty refunds poster, refuses new work", () => {
  create(); s.mineEmptyBurnBlocks(12);
  assert.deepEqual(call("submit-work", [Cl.uint(2), Cl.stringAscii("x")], B1), Cl.error(Cl.uint(105)));
  assert.deepEqual(call("cancel-and-refund", [Cl.uint(2)], B1), Cl.error(Cl.uint(103)));
  assert.deepEqual(call("cancel-and-refund", [Cl.uint(2)], P), Cl.ok(Cl.bool(true))); assert.equal(bal(P), 75000);
});
console.log("all bounty scenarios passed");
