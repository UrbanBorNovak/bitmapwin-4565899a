/**
 * Maker-side signing of a BW-BARTER-1 swap: picks and validates the key details
 * the wallet needs (makerSigningKeys), adds them to input 0, and asks the wallet
 * to sign only input 0. Never broadcasts.
 */
import { signParentInputsPsbt, type ConnectedWallet, type WalletProviderId } from "@/lib/browser-wallet";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import { prepareMakerInput } from "@/lib/psbt-buyer";
import { makerSigningKeys, type MakerKeys } from "@/lib/psbt-scripts";

export const SUPPORTED_SWAP_WALLETS: WalletProviderId[] = ["unisat", "xverse"];

/** Which key details the connected wallet can supply for the maker's item; refused paths explain why. */
export function makerKeysFor(wallet: Pick<ConnectedWallet, "provider" | "ordinalsAddress" | "publicKey" | "paymentPublicKey">): MakerKeys {
  if (!SUPPORTED_SWAP_WALLETS.includes(wallet.provider)) return { ok: false, reason: "Swaps can be signed only with UniSat or Xverse for now." };
  let script: number[];
  try { script = addressToScriptPubKey(wallet.ordinalsAddress); } catch { return { ok: false, reason: "Your ordinals address can't be read." }; }
  return makerSigningKeys(script, [wallet.publicKey, wallet.paymentPublicKey]);
}

type Signer = (provider: WalletProviderId, psbt: string, address: string, indices: number[]) => Promise<string>;

export async function signMakerSwap(wallet: ConnectedWallet, psbtBase64: string, sign: Signer = signParentInputsPsbt): Promise<string> {
  const keys = makerKeysFor(wallet);
  if (!keys.ok) throw new Error(keys.reason);
  const prepared = prepareMakerInput(psbtBase64, keys.tapKeyHex, keys.publicKeys);
  return sign(wallet.provider, prepared, wallet.ordinalsAddress, [0]);
}
