import * as T from "@stacks/transactions";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
export const H = "https://api.testnet.hiro.so";
const derive = (seed, d) => bytesToHex(sha256(utf8ToBytes(`${d}|${process.env[seed]}`))) + "01";
export const adminKey = derive("STACKS_PILOT_ADMIN_SEED", "BW-STACKS-1/testnet/admin");
export const oracleKey = derive("STACKS_PILOT_ORACLE_SEED", "BW-STACKS-1/testnet/oracle");
export const pauserKey = derive("STACKS_PILOT_PAUSER_SEED", "BW-STACKS-1/testnet/pauser");
// Testnet stand-in for the 2-of-3 treasury: three keys derived from the admin seed.
export const tKeys = ["a", "b", "c"].map((x) => derive("STACKS_PILOT_ADMIN_SEED", `BW-STACKS-1/testnet/treasury/${x}`));
export const tPubs = tKeys.map((k) => T.privateKeyToPublic(k));
export const ADMIN = T.privateKeyToAddress(adminKey, "testnet");
export const PAUSER = T.privateKeyToAddress(pauserKey, "testnet");
export const TREASURY = T.addressToString(T.addressFromPublicKeys(T.AddressVersion.TestnetMultiSig, T.AddressHashMode.P2SH, 2, tPubs.map((p) => T.createStacksPublicKey(p))));
export const STAKE = `${ADMIN}.bw-stake-pilot-v2`;
export const TOKEN = "ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-test-sbtc";
export const nonceOf = (a) => T.fetchNonce({ address: a, network: "testnet" });
export async function send(tx, label) {
  const r = await T.broadcastTransaction({ transaction: tx, network: "testnet" });
  console.log(label, r.txid ? "0x" + r.txid.replace(/^0x/, "") : JSON.stringify(r).slice(0, 300));
  return r.txid;
}
export const call = (contract, fn, args, opts) => {
  const [contractAddress, contractName] = contract.split(".");
  return T.makeContractCall({ contractAddress, contractName, functionName: fn, functionArgs: args, network: "testnet", fee: 30000n, postConditionMode: T.PostConditionMode.Allow, ...opts });
};
export const asAdmin = (c, fn, args, nonce) => call(c, fn, args, { senderKey: adminKey, nonce });
export const asTreasury = (c, fn, args, nonce) => call(c, fn, args, { numSignatures: 2, publicKeys: tPubs, signerKeys: [tKeys[0], tKeys[1]], nonce, fee: 40000n });
export async function ro(fn, args = []) {
  const [contractAddress, contractName] = STAKE.split(".");
  return T.cvToJSON(await T.fetchCallReadOnlyFunction({ contractAddress, contractName, functionName: fn, functionArgs: args, senderAddress: ADMIN, network: "testnet" }));
}
export const { Cl } = T;
export { T };
