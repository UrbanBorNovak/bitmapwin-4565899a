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
  const accounts = await requestXverseAddresses(xverse);

  const ordinals =
    accounts.find((a) => a.purpose === "ordinals") ??
    accounts.find((a) => (a.addressType ?? "").toLowerCase().includes("p2tr")) ??
    accounts[0]!;
  const payment =
    accounts.find((a) => a.purpose === "payment") ??
    accounts.find((a) => a !== ordinals) ??
    ordinals;

  return {
    provider,
    ordinalsAddress: ordinals.address,
    paymentAddress: payment.address,
    ...(ordinals.publicKey ? { publicKey: ordinals.publicKey } : {}),
  };
}

/** Normalizes every shape Xverse has shipped for address responses. */
function normalizeXverseAddresses(result: unknown): XverseAccount[] {
  if (!result) return [];
  if (Array.isArray(result)) return result.filter((a) => a && typeof a.address === "string");
  const obj = result as { addresses?: unknown; address?: unknown };
  if (Array.isArray(obj.addresses)) return normalizeXverseAddresses(obj.addresses);
  if (typeof obj.address === "string") return [result as XverseAccount];
  return [];
}

/**
 * Xverse exposes several RPC generations at once (`wallet_connect`,
 * `getAddresses`, `wallet_getAccount`, `getAccounts`) and rejects the ones its
 * build does not implement, so try each in turn and only fail if none answers.
 */
async function requestXverseAddresses(xverse: XverseProvider): Promise<XverseAccount[]> {
  const message = "CONNECT TO BITMAP MARKETPLACE";
  const attempts: Array<{ method: string; params?: unknown }> = [
    { method: "wallet_connect", params: { addresses: ["ordinals", "payment"], message } },
    { method: "getAddresses", params: { purposes: ["ordinals", "payment"], message } },
    { method: "wallet_getAccount", params: undefined },
    { method: "getAccounts", params: { purposes: ["ordinals", "payment"], message } },
  ];

  let lastError = "";
  for (const attempt of attempts) {
    try {
      const res = await xverse.request(attempt.method, attempt.params);
      if (res?.status === "success") {
        const accounts = normalizeXverseAddresses(res.result);
        if (accounts.length > 0) return accounts;
        lastError = "XVERSE RETURNED NO ADDRESSES";
        continue;
      }
      const msg = res?.error?.message ?? "";
      if (/reject|denied|cancel/i.test(msg)) throw new Error(msg.toUpperCase());
      lastError = msg || lastError;
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      if (/reject|denied|cancel/i.test(msg)) throw new Error(msg.toUpperCase());
      lastError = msg || lastError;
    }
  }
  throw new Error((lastError || "XVERSE CONNECT FAILED").toUpperCase());
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
    if (typeof signedHex !== "string" || signedHex.length < 20) {
      throw new Error("UNISAT RETURNED NO SIGNED PSBT");
    }
    return /^[0-9a-fA-F]+$/.test(signedHex.trim()) ? hexToBase64(signedHex) : signedHex.trim();
  }
  const xverse = getXverse();
  if (!xverse) throw new Error("XVERSE NOT DETECTED");
  const res = await xverse.request<{ psbt?: string; psbtBase64?: string }>("signPsbt", {
    psbt: psbtBase64,
    signInputs: { [sellerAddress]: [0] },
    broadcast: false,
  });
  if (res.status !== "success") {
    throw new Error((res.error?.message ?? "XVERSE SIGN REJECTED").toUpperCase());
  }
  const signed =
    typeof res.result === "string" ? res.result : res.result?.psbt ?? res.result?.psbtBase64;
  if (typeof signed !== "string" || signed.length < 20) {
    throw new Error("XVERSE RETURNED NO SIGNED PSBT");
  }
  return signed;
}

/**
 * Signs the buyer half of a purchase PSBT: only the buyer's funding inputs are
 * signed, and the wallet is asked to finalize them so the transaction can be
 * broadcast (the seller's input already carries its signature).
 */
export async function signPurchasePsbt(
  provider: WalletProviderId,
  psbtBase64: string,
  buyerPaymentAddress: string,
  signIndices: number[],
): Promise<string> {
  if (signIndices.length === 0) throw new Error("NOTHING TO SIGN IN THIS PURCHASE");
  if (provider === "unisat") {
    const unisat = getUnisat();
    if (!unisat) throw new Error("UNISAT NOT DETECTED");
    const signed = await unisat.signPsbt(base64ToHex(psbtBase64), {
      autoFinalized: true,
      toSignInputs: signIndices.map((index) => ({ index, address: buyerPaymentAddress })),
    });
    if (typeof signed !== "string" || signed.length < 20) {
      throw new Error("UNISAT RETURNED NO SIGNED PSBT");
    }
    return /^[0-9a-fA-F]+$/.test(signed.trim()) ? hexToBase64(signed) : signed.trim();
  }
  const xverse = getXverse();
  if (!xverse) throw new Error("XVERSE NOT DETECTED");
  const res = await xverse.request<{ psbt?: string; psbtBase64?: string }>("signPsbt", {
    psbt: psbtBase64,
    signInputs: { [buyerPaymentAddress]: signIndices },
    broadcast: false,
  });
  if (res.status !== "success") {
    throw new Error((res.error?.message ?? "XVERSE SIGN REJECTED").toUpperCase());
  }
  const signed =
    typeof res.result === "string" ? res.result : res.result?.psbt ?? res.result?.psbtBase64;
  if (typeof signed !== "string" || signed.length < 20) {
    throw new Error("XVERSE RETURNED NO SIGNED PSBT");
  }
  return signed;
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
