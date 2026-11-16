/**
 * Testnet-only soft-stake pilot (BW-STACKS-1). Browser-safe constants and the
 * attestation tuple shared by the oracle signer and the tests. Tokens here are
 * BitmapWin Test sBTC on Stacks testnet and have no value.
 */
import { Cl, serializeCV } from "@stacks/transactions";
import { sha256 } from "@noble/hashes/sha2.js";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils.js";

export const PILOT_NETWORK = "testnet" as const;
export const TESTNET_CHAIN_ID = 0x80000000;
export const HIRO_TESTNET = "https://api.testnet.hiro.so";
export const PILOT_DEPLOYER = "ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F";
export const PILOT_STAKE = `${PILOT_DEPLOYER}.bw-stake-pilot-v1`;
export const PILOT_TOKEN = `${PILOT_DEPLOYER}.bw-test-sbtc`;
export const EXPLORER_TX = (txid: string) => `https://explorer.hiro.so/txid/${txid.startsWith("0x") ? txid : `0x${txid}`}?chain=testnet`;
export const STX_FAUCET = "https://explorer.hiro.so/sandbox/faucet?chain=testnet";

export type Attestation = { epoch: number; height: number; owner: string; weight: number; issued: number };

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
