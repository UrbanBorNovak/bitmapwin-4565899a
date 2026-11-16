import { initSimnet } from "@hirosystems/clarinet-sdk";
import { Cl, serializeCV, signMessageHashRsv, privateKeyToPublic, randomPrivateKey } from "@stacks/transactions";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const simnet = await initSimnet("./Clarinet.toml");
const a = simnet.getAccounts();
const D = a.get("deployer"), W1 = a.get("wallet_1"), W2 = a.get("wallet_2"), P = a.get("wallet_3");
const SELF = `${D}.stake`;
const k1 = randomPrivateKey(), k2 = randomPrivateKey(), k3 = randomPrivateKey();
const pub = (k) => Cl.bufferFromHex(privateKeyToPublic(k));
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log("✓", name); };

const call = (fn, args, who) => simnet.callPublicFn("stake", fn, args, who).result;
const ro = (fn, args) => simnet.callReadOnlyFn("stake", fn, args, D).result;
const bal = (w) => Number(simnet.callReadOnlyFn("mock-sbtc", "get-balance", [Cl.principal(w)], D).result.value.value);
const chain = 2147483648n; // simnet/testnet chain-id

// Off-chain signer: must reproduce the contract's hash byte-for-byte.
function attHash(e, h, owner, weight, issued) {
  const tuple = Cl.tuple({ domain: Cl.stringAscii("BW-STACKS-1"), contract: Cl.principal(SELF), chain: Cl.uint(chain),
    epoch: Cl.uint(e), height: Cl.uint(h), owner: Cl.principal(owner), weight: Cl.uint(weight), issued: Cl.uint(issued) });
  const bytes = serializeCV(tuple);
  return createHash("sha256").update(Buffer.from(typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("hex"), "hex")).digest("hex");
}
const sign = (key, e, h, owner, weight, issued) =>
  Cl.bufferFromHex(signMessageHashRsv({ messageHash: attHash(e, h, owner, weight, issued), privateKey: key }));
const tip = () => simnet.burnBlockHeight;
const attest = (key, e, h, w, who, issued = tip()) =>
  call("attest", [Cl.uint(e), Cl.uint(h), Cl.uint(w), Cl.uint(issued), sign(key, e, h, who, w, issued)], who);
const fund = (n) => call("fund", [Cl.uint(n)], D);
const err = (r) => (r.type === "err" || r.type === 8 ? Number(r.value.value) : null);
const isOk = (r) => r.type === "ok" || r.type === 7;

simnet.callPublicFn("mock-sbtc", "mint", [Cl.uint(10_000_000), Cl.principal(D)], D);

ok("off-chain hash matches contract", () => {
  const onchain = ro("attestation-hash", [Cl.uint(1), Cl.uint(5), Cl.principal(W1), Cl.uint(7), Cl.uint(9)]);
  assert.equal(String(onchain.value).replace(/^0x/, ""), attHash(1, 5, W1, 7, 9));
});

ok("only admin manages keys and pausers", () => {
  assert.equal(err(call("schedule-key", [pub(k1)], W1)), 401);
  assert.ok(isOk(call("schedule-key", [pub(k1)], D)));
  assert.ok(isOk(call("set-pauser", [Cl.principal(P), Cl.bool(true)], D)));
});

ok("holder attests, funding is paid on claim", () => {
  assert.ok(isOk(attest(k1, 1, 552718, 100, W1)));
  assert.ok(isOk(fund(10_000)));
  const before = bal(W1);
  assert.ok(isOk(call("claim", [Cl.uint(552718)], W1)));
  assert.equal(bal(W1) - before, 10_000);
});

ok("forged, replayed, oversize and stale attestations refused", () => {
  assert.equal(err(attest(k2, 1, 1, 100, W2)), 402);                    // wrong key
  const i = tip();
  const sigForW1 = sign(k1, 1, 2, W1, 100, i);
  assert.equal(err(call("attest", [Cl.uint(1), Cl.uint(2), Cl.uint(100), Cl.uint(i), sigForW1], W2)), 402); // bound to sender
  assert.equal(err(attest(k1, 1, 3, 2923, W2)), 408);
  const old = tip(); simnet.mineEmptyBurnBlocks(7);
  assert.equal(err(attest(k1, 1, 3, 100, W2, old)), 406);
});

ok("rate cap limits new weight per block", () => {
  call("set-rate-cap", [Cl.uint(50)], D);
  assert.equal(err(attest(k1, 1, 4, 100, W2)), 409);
  call("set-rate-cap", [Cl.uint(20000)], D);
});

ok("pauser can pause but nothing else", () => {
  assert.ok(isOk(call("pause", [], P)));
  assert.equal(err(attest(k1, 1, 5, 100, W1)), 403);
  assert.equal(err(call("claim", [Cl.uint(552718)], W1)), 403);
  assert.equal(err(call("unpause", [], P)), 401);
  assert.equal(err(call("emergency-key", [pub(k2), Cl.uint(0)], P)), 401);
  assert.ok(isOk(call("unpause", [], D)));
});

let w1Before;
ok("stolen key: forged stake earns nothing, honest holder keeps everything", () => {
  const compromisedFrom = tip();
  simnet.mineEmptyBurnBlocks(1);
  assert.ok(isOk(attest(k1, 1, 1, 2922, W2)));                          // attacker with stolen key
  w1Before = bal(W1);
  assert.ok(isOk(fund(30_220)));                                         // split 100 : 2922
  assert.ok(isOk(call("pause", [], P)));
  assert.equal(err(call("emergency-key", [pub(k2), Cl.uint(compromisedFrom)], W1)), 401);
  assert.ok(isOk(call("emergency-key", [pub(k2), Cl.uint(compromisedFrom)], D)));
  assert.ok(isOk(call("unpause", [], D)));
  assert.equal(err(call("claim", [Cl.uint(1)], W2)), 407);
  const w2 = bal(W2);
  assert.ok(isOk(call("evict", [Cl.uint(1)], P)));                       // void → recycled
  assert.equal(bal(W2), w2);
  assert.ok(isOk(call("claim", [Cl.uint(552718)], W1)));
  assert.ok(bal(W1) - w1Before >= 30_219);
});

ok("revoked key stops working, new key works at once", () => {
  assert.equal(err(attest(k1, 1, 6, 100, W1)), 407);
  assert.ok(isOk(attest(k2, 2, 552718, 120, W1)));
});

ok("scheduled rotation: delay, then overlap, then old key retires", () => {
  assert.ok(isOk(call("schedule-key", [pub(k3)], D)));
  assert.equal(err(attest(k3, 3, 7, 100, W2)), 407);
  simnet.mineEmptyBurnBlocks(145);
  assert.ok(isOk(attest(k3, 3, 7, 100, W2)));
  assert.ok(isOk(attest(k2, 2, 8, 100, W2)));
  simnet.mineEmptyBurnBlocks(145);
  assert.equal(err(attest(k2, 2, 9, 100, W2)), 407);
});

ok("expired stake can't claim; eviction pays the owner", () => {
  assert.ok(isOk(attest(k3, 3, 10, 500, W1)));
  assert.ok(isOk(fund(100_000)));
  simnet.mineEmptyBurnBlocks(150);
  assert.equal(err(call("claim", [Cl.uint(10)], W1)), 406);
  const b = bal(W1);
  assert.ok(isOk(call("evict", [Cl.uint(10)], P)));
  assert.ok(bal(W1) > b);
});
console.log(`${passed} passed`);
