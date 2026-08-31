import { useEffect, useState } from "react";
import type { ConnectedWallet } from "@/lib/browser-wallet";

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

/** Reactive read of the stored wallet session. */
export function useWalletSession(): ConnectedWallet | null {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);

  useEffect(() => {
    const sync = () => setWallet(loadWalletSession());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return wallet;
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
