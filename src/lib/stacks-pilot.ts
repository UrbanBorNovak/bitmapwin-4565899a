/**
 * Testnet-only soft-stake pilot (BW-STACKS-1). Browser-safe constants and the
 * attestation tuple shared by the oracle signer and the tests. Tokens here are
 * BitmapWin Test sBTC on Stacks testnet and have no value.
 * Keep this file free of @stacks/* imports: the site router loads it, and the
 * Stacks bundle pulls in browser-only wallet code that crashes the live server.
 */

export const PILOT_NETWORK = "testnet" as const;
export const TESTNET_CHAIN_ID = 0x80000000;
export const HIRO_TESTNET = "https://api.testnet.hiro.so";
/** Throwaway key that deployed the test token (holds no role). */
export const PILOT_DEPLOYER = "ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F";
/** v2 adds treasury-only funding with per-call, per-reward-period and pool-balance caps. Deployed by the testnet admin. */
export const PILOT_STAKE = "ST2P0SD4JPHFKJ42DDH2VQVS59P7XJFYC4K8NHGWR.bw-stake-pilot-v2";
export const PILOT_TOKEN = `${PILOT_DEPLOYER}.bw-test-sbtc`;
/** Testnet stand-in for the treasury: a 2-of-3 Stacks multisig. The only principal the contract accepts `fund` from. */
export const PILOT_TREASURY = "SN38Y8C9FJ7J624BJJK7ZY5HBN790X6646M3XB25X";
export const EXPLORER_TX = (txid: string) => `https://explorer.hiro.so/txid/${txid.startsWith("0x") ? txid : `0x${txid}`}?chain=testnet`;
export const STX_FAUCET = "https://explorer.hiro.so/sandbox/faucet?chain=testnet";

export type Attestation = { epoch: number; height: number; owner: string; weight: number; issued: number };


/** BW-BOUNTY-1 Builder Bounties escrow (testnet, test sBTC). No admin, no fee. */
export const BOUNTY_CONTRACT = "ST2P0SD4JPHFKJ42DDH2VQVS59P7XJFYC4K8NHGWR.bw-bounty-v1";
export const BOUNTY_DEPLOY_TX = "0xee9686d493d6d7379f7c3f727326a12eca87ba494e8ef105cc2d62131b64671b";
