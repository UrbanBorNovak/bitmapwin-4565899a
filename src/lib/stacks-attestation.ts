/** Attestation hash for the testnet pilot (server signer + tests only). */
import { Cl, serializeCV } from "@stacks/transactions";
import { sha256 } from "@noble/hashes/sha2.js";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils.js";
import { PILOT_STAKE, TESTNET_CHAIN_ID, type Attestation } from "@/lib/stacks-pilot";

/** sha256 of the Clarity tuple the contract hashes in `attestation-hash`. */
export function attestationHash(a: Attestation, contract = PILOT_STAKE, chainId = TESTNET_CHAIN_ID): string {
  if (!contract.startsWith("ST") && !contract.startsWith("SN")) throw new Error("Pilot contract must be on testnet");
  const tuple = Cl.tuple({
    domain: Cl.stringAscii("BW-STACKS-1"), contract: Cl.principal(contract), chain: Cl.uint(chainId),
    epoch: Cl.uint(a.epoch), height: Cl.uint(a.height), owner: Cl.principal(a.owner),
    weight: Cl.uint(a.weight), issued: Cl.uint(a.issued),
  });
  const ser = serializeCV(tuple) as unknown;
  const bytes = typeof ser === "string" ? hexToBytes(ser.replace(/^0x/, "")) : (ser as Uint8Array);
  return bytesToHex(sha256(bytes));
}
