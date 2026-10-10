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

/**
 * Re-reads the public keys for an already connected wallet. Sessions stored
 * before the payment key was tracked (or wallets that withheld it on connect)
 * would otherwise dead-end on nested-segwit signing; this refills the keys
 * without asking the user to disconnect and reconnect.
 */
export async function refreshWalletKeys(wallet: ConnectedWallet): Promise<ConnectedWallet> {
  if (wallet.provider === "unisat") {
    const unisat = getUnisat();
    if (!unisat) return wallet;
    try {
      const publicKey = await unisat.getPublicKey();
      if (!publicKey) return wallet;
      return { ...wallet, publicKey, paymentPublicKey: publicKey };
    } catch {
      return wallet;
    }
  }

  const providerId = getXverseProviderId();
  if (!providerId) return wallet;
  let accounts: XverseAccount[] = [];
  try {
    const res = await requestSatsConnect("getAddresses", {
      purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment],
      message: "Refresh Bitmap Marketplace keys",
    } as never, providerId);
    accounts = res.status === "success" ? normalizeXverseAddresses(res.result) : [];
  } catch {
    accounts = [];
  }
  if (accounts.length === 0) {
    accounts = await requestXverseAddresses(providerId).catch(() => []);
  }
  if (accounts.length === 0) return wallet;

  const lower = (v: string) => v.toLowerCase();
  const ordinals =
    accounts.find((a) => lower(a.address) === lower(wallet.ordinalsAddress)) ??
    accounts.find((a) => a.purpose === "ordinals");
  const payment =
    accounts.find((a) => lower(a.address) === lower(wallet.paymentAddress)) ??
    accounts.find((a) => a.purpose === "payment");

  return {
    ...wallet,
    ...(ordinals?.publicKey ? { publicKey: ordinals.publicKey } : {}),
    ...(payment?.publicKey ? { paymentPublicKey: payment.publicKey } : {}),
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
const SIGHASH_ALL = 0x01;

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

/**
 * Xverse's generic signPsbt request rejects otherwise-valid transactions that
 * contain the Shadow protocol's OP_RETURN output. Its transaction-signing API
 * accepts the same PSBT when every payer input and SIGHASH_ALL are explicit.
 */
async function xverseSignPaymentPsbt(
  psbtBase64: string,
  payerAddress: string,
  signIndices: number[],
  message = "Write Shadow pass note onto Bitcoin",
  sigHash: number | undefined = SIGHASH_ALL,
): Promise<string> {
  const provider = getXverse();
  if (!provider || typeof provider.signTransaction !== "function") {
    throw new Error("XVERSE TRANSACTION SIGNING IS UNAVAILABLE — UPDATE THE XVERSE EXTENSION");
  }

  return new Promise<string>((resolve, reject) => {
    void signXverseTransaction({
      payload: {
        network: { type: BitcoinNetworkType.Mainnet },
        message,

        psbtBase64,
        inputsToSign: [
          {
            address: payerAddress,
            signingIndexes: signIndices,
            ...(sigHash === undefined ? {} : { sigHash }),
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
  return xverseSignPaymentPsbt(psbtBase64, buyerPaymentAddress, signIndices);
}

/**
 * Signs the inputs that pass the holder's own inscription through a reveal
 * transaction, leaving the transaction unfinalized so the other signers (the
 * throwaway inscription key and the collection key) can add theirs.
 */
export async function signParentInputsPsbt(
  provider: WalletProviderId,
  psbtBase64: string,
  holderAddress: string,
  signIndices: number[],
): Promise<string> {
  if (signIndices.length === 0) return psbtBase64;
  // Taproot key-path inputs sign with SIGHASH_DEFAULT; forcing ALL is rejected.
  const taproot = /^bc1p/i.test(holderAddress);
  if (provider === "unisat") {
    const unisat = getUnisat();
    if (!unisat) throw new Error("UNISAT NOT DETECTED");
    const signed = await unisat.signPsbt(base64ToHex(psbtBase64), {
      autoFinalized: false,
      toSignInputs: signIndices.map((index) =>
        taproot ? { index, address: holderAddress } : { index, address: holderAddress, sighashTypes: [SIGHASH_ALL] },
      ),
    });
    if (typeof signed !== "string" || signed.length < 20) throw new Error("UNISAT RETURNED NO SIGNED PSBT");
    return /^[0-9a-fA-F]+$/.test(signed.trim()) ? hexToBase64(signed) : signed.trim();
  }
  if (taproot) {
    // Xverse rejects signPsbt when an input's sighash isn't explicitly
    // whitelisted ("Sighash type is not allowed"). signTransaction carries an
    // explicit per-input sigHash, so try it first with SIGHASH_ALL.
    try {
      return await xverseSignPaymentPsbt(
        psbtBase64,
        holderAddress,
        signIndices,
        "Claim this bitmap as the parent of a new inscription",
        SIGHASH_ALL,
      );
    } catch (error) {
      if (/DECLINED/i.test((error as Error).message)) throw error;
      try {
        return await xverseSignPsbt({
          psbt: psbtBase64,
          signInputs: { [holderAddress]: signIndices },
          broadcast: false,
        });
      } catch (second) {
        if (/DECLINED/i.test((second as Error).message)) throw second;
        const direct = await xverseSignPsbtDirect(psbtBase64, holderAddress, signIndices);
        if (direct) return direct;
        throw error;
      }
    }
  }
  return xverseSignPaymentPsbt(psbtBase64, holderAddress, signIndices, "Claim this bitmap as the parent of a new inscription", SIGHASH_ALL);
}

/**
 * Calls Xverse's injected provider directly so `allowedSignHash` survives —
 * Sats-Connect's schema sanitizer strips it. Returns null when no direct
 * provider exists; throws on user decline or a definitive signing error.
 */
async function xverseSignPsbtDirect(
  psbtBase64: string,
  address: string,
  indices: number[],
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    XverseProviders?: { BitcoinProvider?: { request?: (m: string, p: unknown) => Promise<unknown> } };
    BitcoinProvider?: { request?: (m: string, p: unknown) => Promise<unknown> };
  };
  const provider = w.XverseProviders?.BitcoinProvider ?? w.BitcoinProvider;
  if (!provider?.request) return null;
  let lastError: unknown = null;
  for (const allowedSignHash of [1, 0]) {
    try {
      const res = (await provider.request("signPsbt", {
        psbt: psbtBase64,
        signInputs: { [address]: indices },
        allowedSignHash,
        broadcast: false,
      })) as { result?: { psbt?: string } | string; error?: { code?: unknown; message?: string }; psbt?: string } | string;
      if (typeof res === "string" && res.length > 20) return res;
      if (res && typeof res === "object") {
        if (res.error) throw res.error;
        const r = res.result;
        const signed = typeof r === "string" ? r : r?.psbt ?? res.psbt;
        if (typeof signed === "string" && signed.length > 20) return signed;
      }
      lastError = new Error("XVERSE RETURNED NO SIGNED PSBT");
    } catch (error) {
      const n = normalizeXverseError(error);
      if (String(n.code) === "4001" || /reject|denied|cancel/i.test(n.message ?? "")) {
        throw new Error("XVERSE SIGNING WAS DECLINED IN THE WALLET");
      }
      lastError = error;
    }
  }
  console.warn("[xverse direct signPsbt] falling back", lastError);
  return null;
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

/**
 * Every compressed public key the wallet shared, payment key first. PSBT
 * builders test each one against the funding scriptPubKey, so a wallet that
 * mislabels its purposes still produces a signable nested-segwit input.
 */
export function keyCandidates(wallet: ConnectedWallet): string[] {
  const clean = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    const hex = raw.trim().replace(/^0x/i, "").toLowerCase();
    // Only full public keys are usable for legacy/nested-segwit inputs.
    // 64-char x-only taproot keys go through tapInternalKeyHex instead.
    return /^[0-9a-f]{66}$|^[0-9a-f]{130}$/.test(hex) ? hex : null;
  };
  const list = [clean(wallet.paymentPublicKey), clean(wallet.publicKey)].filter(
    (k): k is string => Boolean(k),
  );
  return [...new Set(list)].slice(0, 4);
}

/** Asks the connected wallet to pay a plain amount to one address. Returns the txid. */
export async function sendBitcoinFromWallet(
  provider: WalletProviderId,
  address: string,
  amountSats: number,
): Promise<string> {
  if (provider === "unisat") {
    const unisat = getUnisat() as (UnisatProvider & { sendBitcoin?: (a: string, s: number) => Promise<string> }) | null;
    if (!unisat?.sendBitcoin) throw new Error("UNISAT CANNOT SEND FROM HERE — UPDATE THE EXTENSION");
    return unisat.sendBitcoin(address, amountSats);
  }
  const res = await requestSatsConnect(
    "sendTransfer",
    { recipients: [{ address, amount: amountSats }] } as never,
    getXverseProviderId(),
  );
  if (res.status !== "success") throw new Error(describeXverseSignError(res.error));
  const txid = (res.result as { txid?: string }).txid;
  if (!txid) throw new Error("XVERSE RETURNED NO TRANSACTION ID");
  return txid;
}
