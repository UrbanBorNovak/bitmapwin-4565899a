export type WalletProviderId = "unisat" | "xverse";

export type ConnectedWallet = {
  provider: WalletProviderId;
  /** ordinals / taproot address that holds inscriptions */
  ordinalsAddress: string;
  /** payment address used to fund purchases (may equal ordinalsAddress on unisat) */
  paymentAddress: string;
  publicKey?: string;
};

export const WALLET_PROVIDER_STORAGE_KEY = "bitmap.wallet.provider";

export const WALLET_LABEL: Record<WalletProviderId, string> = {
  unisat: "UNISAT",
  xverse: "XVERSE",
};

export const WALLET_SITE: Record<WalletProviderId, string> = {
  unisat: "https://unisat.io/download",
  xverse: "https://www.xverse.app/download",
};

type UnisatProvider = {
  requestAccounts: () => Promise<string[]>;
  getAccounts: () => Promise<string[]>;
  getPublicKey: () => Promise<string>;
  signPsbt: (psbtHex: string, options?: unknown) => Promise<string>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type XverseRequest = <T = unknown>(
  method: string,
  params?: unknown,
) => Promise<{ status: "success"; result: T } | { status: "error"; error: { message?: string } }>;

type XverseProvider = { request: XverseRequest };

type WindowWithWallets = Window & {
  unisat?: UnisatProvider;
  XverseProviders?: { BitcoinProvider?: XverseProvider };
  BitcoinProvider?: XverseProvider;
};

function w(): WindowWithWallets {
  return window as WindowWithWallets;
}

export function getUnisat(): UnisatProvider | null {
  if (typeof window === "undefined") return null;
  return w().unisat ?? null;
}

export function getXverse(): XverseProvider | null {
  if (typeof window === "undefined") return null;
  return w().XverseProviders?.BitcoinProvider ?? w().BitcoinProvider ?? null;
}

export function isWalletInstalled(provider: WalletProviderId): boolean {
  return provider === "unisat" ? getUnisat() !== null : getXverse() !== null;
}

type XverseAccount = {
  address: string;
  publicKey?: string;
  purpose?: string;
  addressType?: string;
};

export async function connectWallet(provider: WalletProviderId): Promise<ConnectedWallet> {
  if (provider === "unisat") {
    const unisat = getUnisat();
    if (!unisat) throw new Error("UNISAT NOT DETECTED — INSTALL THE EXTENSION");
    const accounts = await unisat.requestAccounts();
    const address = accounts[0];
    if (!address) throw new Error("UNISAT RETURNED NO ACCOUNTS");
    let publicKey: string | undefined;
    try {
      publicKey = await unisat.getPublicKey();
    } catch {
      publicKey = undefined;
    }
    return {
      provider,
      ordinalsAddress: address,
      paymentAddress: address,
      ...(publicKey ? { publicKey } : {}),
    };
  }

  const xverse = getXverse();
  if (!xverse) throw new Error("XVERSE NOT DETECTED — INSTALL THE EXTENSION");
  const res = await xverse.request<XverseAccount[]>("wallet_connect", {
    addresses: ["ordinals", "payment"],
    message: "CONNECT TO BITMAP MARKETPLACE",
  }).catch(() => null);

  let accounts: XverseAccount[] | null = null;
  if (res && res.status === "success" && Array.isArray(res.result)) {
    accounts = res.result;
  } else {
    // older API surface
    const legacy = await xverse.request<{ addresses: XverseAccount[] } | XverseAccount[]>(
      "getAccounts",
      { purposes: ["ordinals", "payment"], message: "CONNECT TO BITMAP MARKETPLACE" },
    );
    if (legacy.status !== "success") {
      throw new Error((legacy.error?.message ?? "XVERSE CONNECT REJECTED").toUpperCase());
    }
    accounts = Array.isArray(legacy.result) ? legacy.result : legacy.result.addresses;
  }

  if (!accounts || accounts.length === 0) throw new Error("XVERSE RETURNED NO ADDRESSES");
  const ordinals =
    accounts.find((a) => a.purpose === "ordinals") ??
    accounts.find((a) => (a.addressType ?? "").includes("p2tr")) ??
    accounts[0]!;
  const payment = accounts.find((a) => a.purpose === "payment") ?? ordinals;

  return {
    provider,
    ordinalsAddress: ordinals.address,
    paymentAddress: payment.address,
    ...(ordinals.publicKey ? { publicKey: ordinals.publicKey } : {}),
  };
}

/** Sign a base64 PSBT with the connected wallet. Returns a base64 PSBT. */
export async function signPsbtBase64(
  provider: WalletProviderId,
  psbtBase64: string,
): Promise<string> {
  if (provider === "unisat") {
    const unisat = getUnisat();
    if (!unisat) throw new Error("UNISAT NOT DETECTED");
    const hex = base64ToHex(psbtBase64);
    const signedHex = await unisat.signPsbt(hex);
    return hexToBase64(signedHex);
  }
  const xverse = getXverse();
  if (!xverse) throw new Error("XVERSE NOT DETECTED");
  const res = await xverse.request<{ psbt: string }>("signPsbt", { psbt: psbtBase64 });
  if (res.status !== "success") {
    throw new Error((res.error?.message ?? "XVERSE SIGN REJECTED").toUpperCase());
  }
  return res.result.psbt;
}

const SIGHASH_SINGLE_ANYONECANPAY = 0x83;

/**
 * Signs the seller half of a listing PSBT without finalizing it, so the buyer
 * can still append funding inputs and receive outputs. UniSat needs the
 * sighash pinned per input; Xverse needs the input indices per address.
 */
export async function signListingPsbt(
  provider: WalletProviderId,
  psbtBase64: string,
  sellerAddress: string,
): Promise<string> {
  if (provider === "unisat") {
    const unisat = getUnisat();
    if (!unisat) throw new Error("UNISAT NOT DETECTED");
    const signedHex = await unisat.signPsbt(base64ToHex(psbtBase64), {
      autoFinalized: false,
      toSignInputs: [
        { index: 0, address: sellerAddress, sighashTypes: [SIGHASH_SINGLE_ANYONECANPAY] },
      ],
    });
    return hexToBase64(signedHex);
  }
  const xverse = getXverse();
  if (!xverse) throw new Error("XVERSE NOT DETECTED");
  const res = await xverse.request<{ psbt: string }>("signPsbt", {
    psbt: psbtBase64,
    signInputs: { [sellerAddress]: [0] },
    broadcast: false,
  });
  if (res.status !== "success") {
    throw new Error((res.error?.message ?? "XVERSE SIGN REJECTED").toUpperCase());
  }
  return res.result.psbt;
}

/** x-only (32-byte) internal key hex from a compressed public key hex. */
export function xOnlyPubKeyHex(publicKeyHex: string | undefined): string | undefined {
  if (!publicKeyHex) return undefined;
  const clean = publicKeyHex.trim().replace(/^0x/, "");
  if (clean.length === 64) return clean;
  if (clean.length === 66 && (clean.startsWith("02") || clean.startsWith("03"))) {
    return clean.slice(2);
  }
  return undefined;
}

export function base64ToHex(b64: string): string {
  const bin = atob(b64.trim());
  let out = "";
  for (let i = 0; i < bin.length; i += 1) out += bin.charCodeAt(i).toString(16).padStart(2, "0");
  return out;
}

export function hexToBase64(hex: string): string {
  const clean = hex.trim().replace(/^0x/, "");
  let bin = "";
  for (let i = 0; i < clean.length; i += 2) bin += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  return btoa(bin);
}
