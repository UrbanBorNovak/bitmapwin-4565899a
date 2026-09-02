import {
  AddressPurpose,
  BitcoinNetworkType,
  getProviders,
  request as requestSatsConnect,
  signTransaction as signXverseTransaction,
  type BitcoinProvider,
  type SignPsbtParams,
} from "sats-connect";

export type WalletProviderId = "unisat" | "xverse";

export type ConnectedWallet = {
  provider: WalletProviderId;
  /** ordinals / taproot address that holds inscriptions */
  ordinalsAddress: string;
  /** payment address used to fund purchases (may equal ordinalsAddress on unisat) */
  paymentAddress: string;
  publicKey?: string;
  /** compressed public key of the payment address (funding inputs) */
  paymentPublicKey?: string;
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
  signMessage?: (message: string, type?: string) => Promise<string>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};


type XverseRequest = <T = unknown>(
  method: string,
  params?: unknown,
) => Promise<{ status: "success"; result: T } | { status: "error"; error: { message?: string } }>;

type XverseProvider = {
  request: XverseRequest;
  signTransaction?: BitcoinProvider["signTransaction"];
};

type BtcProviderEntry = { id?: string; name?: string };

type WindowWithWallets = Window & {
  unisat?: UnisatProvider;
  XverseProviders?: { BitcoinProvider?: XverseProvider };
  BitcoinProvider?: XverseProvider;
  /** WBIP-004 provider registry — several wallets register here. */
  btc_providers?: BtcProviderEntry[];
  [key: string]: unknown;
};

function w(): WindowWithWallets {
  return window as unknown as WindowWithWallets;
}

export function getUnisat(): UnisatProvider | null {
  if (typeof window === "undefined") return null;
  return w().unisat ?? null;
}

function isRequestProvider(value: unknown): value is XverseProvider {
  return typeof (value as XverseProvider | undefined)?.request === "function";
}

/**
 * Resolves the Xverse provider. Other Bitcoin wallets (Trust, OKX, Leather)
 * also claim `window.BitcoinProvider`, so prefer Xverse's own namespace and the
 * WBIP-004 registry, and only fall back to the shared global last.
 */
export function getXverse(): XverseProvider | null {
  if (typeof window === "undefined") return null;
  const win = w();
  if (isRequestProvider(win.XverseProviders?.BitcoinProvider)) {
    return win.XverseProviders!.BitcoinProvider!;
  }
  const registry = Array.isArray(win.btc_providers) ? win.btc_providers : [];
  const entry = registry.find((p) =>
    `${p?.id ?? ""} ${p?.name ?? ""}`.toLowerCase().includes("xverse"),
  );
  if (entry?.id) {
    const path = entry.id.split(".");
    let node: unknown = win;
    for (const key of path) node = (node as Record<string, unknown> | undefined)?.[key];
    if (isRequestProvider(node)) return node;
  }
  return isRequestProvider(win.BitcoinProvider) ? win.BitcoinProvider : null;
}

function getXverseProviderId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const registered = getProviders().find((provider) =>
    `${provider.id} ${provider.name}`.toLowerCase().includes("xverse"),
  );
  if (registered?.id) return registered.id;
  return isRequestProvider(w().XverseProviders?.BitcoinProvider)
    ? "XverseProviders.BitcoinProvider"
    : undefined;
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
      ...(publicKey ? { publicKey, paymentPublicKey: publicKey } : {}),
    };
  }

  const providerId = getXverseProviderId();
  if (!providerId) throw new Error("XVERSE NOT DETECTED — INSTALL OR ENABLE THE EXTENSION");
  const accounts = await requestXverseAddresses(providerId);

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
    ...(payment.publicKey ? { paymentPublicKey: payment.publicKey } : {}),
  };
}

/** Normalizes address responses returned by current and older Xverse builds. */
function normalizeXverseAddresses(result: unknown): XverseAccount[] {
  if (!result) return [];
  if (Array.isArray(result)) return result.filter((a) => a && typeof a.address === "string");
  const obj = result as { addresses?: unknown; address?: unknown };
  if (Array.isArray(obj.addresses)) return normalizeXverseAddresses(obj.addresses);
  if (typeof obj.address === "string") return [result as XverseAccount];
  return [];
}

/** Connects once through the current Sats Connect API so one click opens one prompt. */
async function requestXverseAddresses(providerId: string): Promise<XverseAccount[]> {
  try {
    const response = await requestSatsConnect(
      "wallet_connect",
      {
        addresses: [AddressPurpose.Ordinals, AddressPurpose.Payment],
        message: "Connect to Bitmap Marketplace",
      },
      providerId,
    );

    if (response.status === "error") {
      const code = String(response.error.code ?? "");
      const message = response.error.message || "XVERSE CONNECTION FAILED";
      if (code === "4001" || /reject|denied|cancel/i.test(message)) {
        throw new Error("XVERSE REQUEST WAS DECLINED");
      }
      throw new Error(`XVERSE: ${message}${code ? ` (${code})` : ""}`);
    }

    const accounts = normalizeXverseAddresses(response.result);
    if (accounts.length === 0) throw new Error("XVERSE RETURNED NO BITCOIN ADDRESSES");
    return accounts;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/XVERSE/i.test(message)) throw error;
    throw new Error(`XVERSE: ${message}`);
  }
}

/**
 * Signs a PSBT through Sats Connect (the API Xverse actually implements) and
 * returns the base64 result. Raw `window.BitcoinProvider.request` calls can
 * resolve never at all in current Xverse builds, which looks like "nothing
 * happens" in the UI.
 */
async function xverseSignPsbt(params: SignPsbtParams): Promise<string> {
  const providerId = getXverseProviderId();
  if (!providerId) throw new Error("XVERSE NOT DETECTED — INSTALL OR ENABLE THE EXTENSION");
  const res = await requestSatsConnect("signPsbt", params, providerId);
  if (res.status !== "success") {
    throw new Error(describeXverseSignError(res.error));
  }
  const result = res.result as unknown;
  const signed =
    typeof result === "string"
      ? result
      : (result as { psbt?: string; psbtBase64?: string })?.psbt ??
        (result as { psbtBase64?: string })?.psbtBase64;
  if (typeof signed !== "string" || signed.length < 20) {
    throw new Error("XVERSE RETURNED NO SIGNED PSBT");
  }
  return signed;
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
  return xverseSignPsbt({ psbt: psbtBase64, broadcast: false });
}

/**
 * Signs a plain message (BIP-322 where the wallet supports it) so a bid can be
 * attributed to the wallet that placed it. The signature is stored with the bid
 * as proof of authorship.
 */
export async function signMessageWithWallet(
  provider: WalletProviderId,
  address: string,
  message: string,
): Promise<string> {
  if (provider === "unisat") {
    const unisat = getUnisat();
    if (!unisat?.signMessage) throw new Error("UNISAT CANNOT SIGN MESSAGES");
    return unisat.signMessage(message, "bip322-simple");
  }
  const providerId = getXverseProviderId();
  if (!providerId) throw new Error("XVERSE NOT DETECTED — INSTALL OR ENABLE THE EXTENSION");
  const res = await requestSatsConnect("signMessage", { address, message }, providerId);
  if (res.status !== "success") throw new Error(describeXverseSignError(res.error));
  const result = res.result as unknown;
  const signature =
    typeof result === "string" ? result : (result as { signature?: string })?.signature;
  if (typeof signature !== "string" || signature.length < 8) {
    throw new Error("XVERSE RETURNED NO SIGNATURE");
  }
  return signature;
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
  return xverseSignListingPsbt(psbtBase64, sellerAddress);
}

/**
 * Xverse's JSON-RPC signPsbt method has no field for approving a non-default
 * sighash, so it rejects marketplace offers even when 0x83 is correctly set
 * in the PSBT input. Its marketplace signing API does support `sigHash` and
 * is the correct path for SINGLE|ANYONECANPAY seller offers.
 */
async function xverseSignListingPsbt(psbtBase64: string, sellerAddress: string): Promise<string> {
  const provider = getXverse();
  if (!provider || typeof provider.signTransaction !== "function") {
    throw new Error("XVERSE MARKETPLACE SIGNING IS UNAVAILABLE — UPDATE THE XVERSE EXTENSION");
  }

  return new Promise<string>((resolve, reject) => {
    void signXverseTransaction({
      payload: {
        network: { type: BitcoinNetworkType.Mainnet },
        message: "List bitmap on Bitmap Marketplace",
        psbtBase64,
        inputsToSign: [
          {
            address: sellerAddress,
            signingIndexes: [0],
            sigHash: SIGHASH_SINGLE_ANYONECANPAY,
          },
        ],
        broadcast: false,
      },
      getProvider: async () => provider as unknown as BitcoinProvider,
      onFinish: (response) => {
        const signed = response.psbtBase64?.trim();
        if (!signed || signed.length < 20) {
          reject(new Error("XVERSE RETURNED NO SIGNED PSBT"));
          return;
        }
        resolve(signed);
      },
      onCancel: () => reject(new Error("XVERSE SIGNING WAS DECLINED IN THE WALLET")),
    }).catch((error: unknown) => {
      reject(new Error(describeXverseSignError(normalizeXverseError(error))));
    });
  });
}

function normalizeXverseError(error: unknown): { code?: unknown; message?: string } {
  if (error instanceof Error) return { message: error.message };
  if (error && typeof error === "object") return error as { code?: unknown; message?: string };
  return { message: String(error) };
}


/** Human-readable Xverse signing failure, keeping the provider's own code. */
function describeXverseSignError(error?: { code?: unknown; message?: string }): string {
  const code = error?.code === undefined || error?.code === null ? "" : String(error.code);
  const message = (error?.message ?? "").trim();
  if (code === "4001" || /reject|denied|cancel/i.test(message)) {
    return "XVERSE SIGNING WAS DECLINED IN THE WALLET";
  }
  if (!message) return `XVERSE COULD NOT SIGN THIS PSBT${code ? ` (${code})` : ""}`;
  return `XVERSE: ${message.toUpperCase()}${code ? ` (${code})` : ""}`;
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
  return xverseSignPsbt({
    psbt: psbtBase64,
    signInputs: { [buyerPaymentAddress]: signIndices },
    broadcast: false,
  });
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
