// Server-only oracle for the testnet soft-stake pilot. Keys are derived from
// project secrets and never leave this module. Mainnet signing does not exist.
import { privateKeyToAddress, privateKeyToPublic, signMessageHashRsv } from "@stacks/transactions";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { attestationHash, HIRO_TESTNET, type Attestation } from "@/lib/stacks-pilot";

/** Oracle key epoch the pilot contract was configured with. */
export const PILOT_ORACLE_EPOCH = 1;

function derive(secretName: string, domain: string): string {
  const seed = process.env[secretName];
  if (!seed || seed.length < 32) throw new Error(`${secretName} missing`);
  const k = sha256(utf8ToBytes(`${domain}|${seed}`));
  if (!secp256k1.utils.isValidSecretKey(k)) throw new Error("derived key out of range");
  return `${bytesToHex(k)}01`; // compressed
}
const oracleKey = () => derive("STACKS_PILOT_ORACLE_SEED", "BW-STACKS-1/testnet/oracle");
const adminKey = () => derive("STACKS_PILOT_ADMIN_SEED", "BW-STACKS-1/testnet/admin");

export function pilotPublicInfo() {
  return {
    network: "testnet" as const,
    oraclePublicKey: privateKeyToPublic(oracleKey()) as string,
    adminAddress: privateKeyToAddress(adminKey(), "testnet"),
  };
}

export function signAttestation(a: Attestation): string {
  return signMessageHashRsv({ messageHash: attestationHash(a), privateKey: oracleKey() });
}

/** Current Stacks-testnet burn block height (the contract's clock). */
export async function testnetBurnHeight(): Promise<number> {
  const r = await fetch(`${HIRO_TESTNET}/v2/info`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`stacks testnet ${r.status}`);
  const h = Number((await r.json())?.burn_block_height);
  if (!Number.isInteger(h) || h <= 0) throw new Error("bad burn height");
  return h;
}
