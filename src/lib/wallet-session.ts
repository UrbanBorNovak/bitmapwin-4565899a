import { useSyncExternalStore } from "react";
import { refreshWalletKeys, type ConnectedWallet } from "@/lib/browser-wallet";

/**
 * Shares the connected wallet across pages (bid panel, marketplace cards,
 * wallet page) without a provider tree. Only public addresses and the public
 * key are persisted — never a signature or private material.
 */
const KEY = "bitmap.wallet.session";
const EVENT = "bitmap:wallet-session";

export function loadWalletSession(): ConnectedWallet | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConnectedWallet;
    if (!parsed?.ordinalsAddress || !parsed?.provider) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWalletSession(wallet: ConnectedWallet) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(wallet));
  window.dispatchEvent(new Event(EVENT));
}

export function clearWalletSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** Reactive read of the stored wallet session. Components mounted after hydration read it immediately. */
let cachedRaw: string | null | undefined;
let cachedWallet: ConnectedWallet | null = null;
function snapshot(): ConnectedWallet | null {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { raw = null; }
  if (raw !== cachedRaw) { cachedRaw = raw; cachedWallet = loadWalletSession(); }
  return cachedWallet;
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
export function useWalletSession(): ConnectedWallet | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/**
 * Guarantees the session carries the payment (and ordinals) public key, which
 * nested-segwit signing needs. Re-reads the keys from the extension and
 * persists them so the user never has to reconnect manually.
 */
export async function ensureWalletKeys(wallet: ConnectedWallet): Promise<ConnectedWallet> {
  if (wallet.paymentPublicKey && wallet.publicKey) return wallet;
  const refreshed = await refreshWalletKeys(wallet);
  if (
    refreshed.paymentPublicKey !== wallet.paymentPublicKey ||
    refreshed.publicKey !== wallet.publicKey
  ) {
    saveWalletSession(refreshed);
  }
  return refreshed;
}

/** True when the session wallet controls the given address (any purpose). */
export function walletControls(wallet: ConnectedWallet | null, address: string | null): boolean {
  if (!wallet || !address) return false;
  const target = address.toLowerCase();
  return (
    wallet.ordinalsAddress.toLowerCase() === target ||
    wallet.paymentAddress.toLowerCase() === target
  );
}
