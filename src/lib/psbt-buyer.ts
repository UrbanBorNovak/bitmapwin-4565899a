/**
 * Buyer half of an ordinal sale PSBT.
 *
 * The seller's offer is a PSBT whose single input (the inscription UTXO) is
 * signed SIGHASH_SINGLE|ANYONECANPAY against output 0 (the asking price paid to
 * the seller). The buyer must therefore keep that input at index 0 and that
 * output at index 0, then append their own funding inputs plus a receive output
 * for the inscription and a change output.
 *
 * Pure TypeScript byte work — no bitcoinjs-lib — so it runs in the browser and
 * inside server functions alike.
 */

import { MARKETPLACE_FEE_ADDRESS, marketplaceFeeSats } from "@/lib/marketplace-fee";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import { isP2pkhScript, isP2trScript, p2shP2wpkhRedeemScript } from "@/lib/psbt-scripts";

const MAGIC = [0x70, 0x73, 0x62, 0x74, 0xff];

type Kv = { key: number[]; value: number[] };

type ParsedPsbt = {
  global: Kv[];
  inputs: Kv[][];
  outputs: Kv[][];
  tx: RawTx;
};

type RawTx = {
  version: number;
  locktime: number;
  inputs: Array<{ txidLe: number[]; vout: number; sequence: number }>;
  outputs: Array<{ valueSats: number; script: number[] }>;
};

export function bytesFromBase64(input: string): number[] {
  const clean = input.replace(/\s+/g, "");
  const bin = typeof atob === "function" ? atob(clean) : Buffer.from(clean, "base64").toString("binary");
  const out: number[] = [];
  for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
  return out;
}

export function base64FromBytes(bytes: number[]): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
}

function varint(value: number): number[] {
  if (value < 0xfd) return [value];
  if (value <= 0xffff) return [0xfd, value & 0xff, (value >> 8) & 0xff];
  if (value <= 0xffffffff) {
    return [0xfe, value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
  }
  const out = [0xff];
  for (let i = 0; i < 8; i++) out.push(Number((BigInt(value) >> BigInt(8 * i)) & 0xffn));
  return out;
}

function u32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function u64le(value: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 8; i++) out.push(Number((BigInt(value) >> BigInt(8 * i)) & 0xffn));
  return out;
}

export function hexToByteArray(hex: string): number[] {
  const clean = hex.trim().replace(/^0x/, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

export function byteArrayToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

class Cursor {
  offset = 0;
  constructor(readonly bytes: number[]) {}
  get done() {
    return this.offset >= this.bytes.length;
  }
  u8(): number {
    if (this.done) throw new Error("PSBT truncated");
    return this.bytes[this.offset++]!;
  }
  take(n: number): number[] {
    if (this.offset + n > this.bytes.length) throw new Error("PSBT truncated");
    const slice = this.bytes.slice(this.offset, this.offset + n);
    this.offset += n;
    return slice;
  }
  uint(n: number): number {
    const slice = this.take(n);
    let value = 0;
    for (let i = slice.length - 1; i >= 0; i--) value = value * 256 + slice[i]!;
    return value;
  }
  varint(): number {
    const first = this.u8();
    if (first < 0xfd) return first;
    if (first === 0xfd) return this.uint(2);
    if (first === 0xfe) return this.uint(4);
    return this.uint(8);
  }
}

function readMap(cursor: Cursor): Kv[] {
  const entries: Kv[] = [];
  for (;;) {
    if (cursor.done) throw new Error("PSBT map not terminated");
    const keyLength = cursor.varint();
    if (keyLength === 0) return entries;
    const key = cursor.take(keyLength);
    const value = cursor.take(cursor.varint());
    entries.push({ key, value });
  }
}

function parseTx(bytes: number[]): RawTx {
  const c = new Cursor(bytes);
  const version = c.uint(4);
  const inputCount = c.varint();
  const inputs: RawTx["inputs"] = [];
  for (let i = 0; i < inputCount; i++) {
    const txidLe = c.take(32);
    const vout = c.uint(4);
    c.take(c.varint());
    inputs.push({ txidLe, vout, sequence: c.uint(4) });
  }
  const outputCount = c.varint();
  const outputs: RawTx["outputs"] = [];
  for (let i = 0; i < outputCount; i++) {
    const valueSats = c.uint(8);
    outputs.push({ valueSats, script: c.take(c.varint()) });
  }
  return { version, locktime: c.uint(4), inputs, outputs };
}

function serializeTx(tx: RawTx): number[] {
  const out: number[] = [...u32le(tx.version), ...varint(tx.inputs.length)];
  for (const input of tx.inputs) {
    out.push(...input.txidLe, ...u32le(input.vout), 0x00, ...u32le(input.sequence));
  }
  out.push(...varint(tx.outputs.length));
  for (const output of tx.outputs) {
    out.push(...u64le(output.valueSats), ...varint(output.script.length), ...output.script);
  }
  out.push(...u32le(tx.locktime));
  return out;
}

export function parsePsbt(psbtBase64: string): ParsedPsbt {
  const bytes = bytesFromBase64(psbtBase64);
  if (MAGIC.some((b, i) => bytes[i] !== b)) throw new Error("Not a PSBT (bad magic)");
  const cursor = new Cursor(bytes);
  cursor.offset = 5;
  const global = readMap(cursor);
  const txEntry = global.find((kv) => kv.key[0] === 0x00);
  if (!txEntry) throw new Error("PSBT has no unsigned transaction");
  const tx = parseTx(txEntry.value);
  const inputs: Kv[][] = [];
  for (let i = 0; i < tx.inputs.length; i++) inputs.push(readMap(cursor));
  const outputs: Kv[][] = [];
  for (let i = 0; i < tx.outputs.length; i++) outputs.push(readMap(cursor));
  return { global, inputs, outputs, tx };
}

function serializeMap(entries: Kv[]): number[] {
  const out: number[] = [];
  for (const { key, value } of entries) {
    out.push(...varint(key.length), ...key, ...varint(value.length), ...value);
  }
  out.push(0x00);
  return out;
}

export function serializePsbt(psbt: ParsedPsbt): string {
  const unsignedTx = { key: [0x00], value: serializeTx(psbt.tx) };
  const hasUnsignedTx = psbt.global.some((kv) => kv.key.length === 1 && kv.key[0] === 0x00);
  const global = hasUnsignedTx
    ? psbt.global.map((kv) =>
        kv.key.length === 1 && kv.key[0] === 0x00 ? unsignedTx : kv,
      )
    : [unsignedTx, ...psbt.global];
  const bytes = [
    ...MAGIC,
    ...serializeMap(global),
    ...psbt.inputs.flatMap((map) => serializeMap(map)),
    ...psbt.outputs.flatMap((map) => serializeMap(map)),
  ];
  return base64FromBytes(bytes);
}

function witnessStack(items: number[][]): number[] {
  return [...varint(items.length), ...items.flatMap((item) => [...varint(item.length), ...item])];
}

/**
 * Converts wallet-produced signatures into PSBT final fields. Marketplace
 * offers deliberately keep the seller signature partial so a buyer can append
 * inputs and outputs; buyer wallets generally only finalize their own inputs.
 * Finalizing the standard key-path forms here makes the completed transaction
 * extractable without ever handling a private key.
 */
export function finalizeSignedPsbt(psbtBase64: string): string {
  const psbt = parsePsbt(psbtBase64);
  let changed = false;

  psbt.inputs = psbt.inputs.map((map) => {
    if (map.some((kv) => kv.key[0] === 0x07 || kv.key[0] === 0x08)) return map;

    const tapKeySig = map.find((kv) => kv.key.length === 1 && kv.key[0] === 0x13);
    if (tapKeySig) {
      changed = true;
      return [...map, { key: [0x08], value: witnessStack([tapKeySig.value]) }];
    }

    const partialSig = map.find((kv) => kv.key[0] === 0x02 && kv.key.length > 1);
    if (!partialSig) return map;
    const publicKey = partialSig.key.slice(1);
    const redeemScript = map.find((kv) => kv.key.length === 1 && kv.key[0] === 0x04)?.value;
    const additions: Kv[] = [
      { key: [0x08], value: witnessStack([partialSig.value, publicKey]) },
    ];
    if (redeemScript) {
      additions.push({ key: [0x07], value: [...varint(redeemScript.length), ...redeemScript] });
    }
    changed = true;
    return [...map, ...additions];
  });

  return changed ? serializePsbt(psbt) : psbtBase64;
}

/** True when every input carries a final scriptSig or final witness. */
export function isFullySigned(psbtBase64: string): boolean {
  const psbt = parsePsbt(psbtBase64);
  return psbt.inputs.every((map) => map.some((kv) => kv.key[0] === 0x07 || kv.key[0] === 0x08));
}

/** Per-input signing state, used to explain exactly what a wallet left unsigned. */
export function inputSignatureReport(
  psbtBase64: string,
): Array<{ index: number; hasSignature: boolean; isFinal: boolean }> {
  const psbt = parsePsbt(psbtBase64);
  return psbt.inputs.map((map, index) => ({
    index,
    hasSignature: map.some(
      (kv) =>
        (kv.key[0] === 0x02 && kv.key.length > 1) ||
        (kv.key.length === 1 && kv.key[0] === 0x13),
    ),
    isFinal: map.some((kv) => kv.key[0] === 0x07 || kv.key[0] === 0x08),
  }));
}

/** Output values and scripts of a PSBT's unsigned transaction. */
export function psbtOutputs(psbtBase64: string): Array<{ valueSats: number; scriptHex: string }> {
  return parsePsbt(psbtBase64).tx.outputs.map((o) => ({
    valueSats: o.valueSats,
    scriptHex: byteArrayToHex(o.script),
  }));
}


/**
 * Extracts the network-serialized transaction from a finalized PSBT so it can
 * be broadcast. Returns null when any input is still unfinalized.
 */
export function extractRawTxHex(psbtBase64: string): string | null {
  const psbt = parsePsbt(psbtBase64);
  const finals = psbt.inputs.map((map) => ({
    scriptSig: map.find((kv) => kv.key[0] === 0x07)?.value ?? null,
    witness: map.find((kv) => kv.key[0] === 0x08)?.value ?? null,
  }));
  if (finals.some((f) => f.scriptSig === null && f.witness === null)) return null;
  const hasWitness = finals.some((f) => f.witness !== null);
  const out: number[] = [...u32le(psbt.tx.version)];
  if (hasWitness) out.push(0x00, 0x01);
  out.push(...varint(psbt.tx.inputs.length));
  psbt.tx.inputs.forEach((input, i) => {
    const scriptSig = finals[i]!.scriptSig ?? [];
    out.push(
      ...input.txidLe,
      ...u32le(input.vout),
      ...varint(scriptSig.length),
      ...scriptSig,
      ...u32le(input.sequence),
    );
  });
  out.push(...varint(psbt.tx.outputs.length));
  for (const output of psbt.tx.outputs) {
    out.push(...u64le(output.valueSats), ...varint(output.script.length), ...output.script);
  }
  if (hasWitness) {
    for (const final of finals) {
      // the witness field is already stored as a serialized witness stack
      if (final.witness) out.push(...final.witness);
      else out.push(0x00);
    }
  }
  out.push(...u32le(psbt.tx.locktime));
  return byteArrayToHex(out);
}

export type FundingUtxo = {
  txid: string;
  vout: number;
  valueSats: number;
  scriptPubKeyHex: string;
};

export type BuyerPsbtInput = {
  /** the seller's signed listing PSBT */
  sellerPsbtBase64: string;
  /** outpoint of the inscription being bought, `txid:vout` */
  inscriptionOutpoint: string;
  /** value in sats of the inscription UTXO (carried into the buyer's output) */
  inscriptionValueSats: number;
  /** scriptPubKey the inscription is delivered to (buyer's ordinals address) */
  receiveScriptHex: string;
  /** scriptPubKey for buyer change (payment address) */
  changeScriptHex: string;
  /** confirmed funding UTXOs of the buyer's payment address */
  funding: FundingUtxo[];
  /** sat/vB */
  feeRate: number;
  /** buyer x-only taproot key, when the funding inputs are p2tr */
  tapInternalKeyHex?: string | undefined;
  /** buyer compressed payment public key(s), required for nested-segwit (3…) inputs */
  paymentPublicKeyHex?: string | string[] | undefined;
  /** optional landholder tribute for sales made in a BITMAP storefront */
  landTribute?: { scriptHex: string; sats: number } | undefined;
};

export type BuyerPsbtResult = {
  psbtBase64: string;
  /** indices the buyer's wallet must sign */
  signIndices: number[];
  priceSats: number;
  feeSats: number;
  /** marketplace commission paid to the platform address */
  marketFeeSats: number;
  landTributeSats: number;
  changeSats: number;
  spentSats: number;
  usedFunding: FundingUtxo[];
};


/**
 * PSBT input map for a funding UTXO. Nested-segwit (P2SH-P2WPKH) inputs get the
 * redeemScript wallets require; taproot inputs get the internal key.
 */
function fundingInputMap(
  utxo: FundingUtxo,
  tapKey: number[] | null,
  paymentPublicKeyHex: string | string[] | undefined,
): Kv[] {
  const script = hexToByteArray(utxo.scriptPubKeyHex);
  const map: Kv[] = [
    { key: [0x01], value: [...u64le(utxo.valueSats), ...varint(script.length), ...script] },
  ];
  if (isP2trScript(script)) {
    if (tapKey) map.push({ key: [0x17], value: tapKey });
    return map;
  }
  // Wallets label their keys inconsistently, so try every key the wallet shared
  // and keep the one that actually hashes to this P2SH address.
  const keys = (
    Array.isArray(paymentPublicKeyHex)
      ? paymentPublicKeyHex
      : paymentPublicKeyHex
        ? [paymentPublicKeyHex]
        : []
  ).filter((k) => typeof k === "string" && k.length > 0);
  for (const key of keys) {
    const redeem = p2shP2wpkhRedeemScript(script, key);
    if (redeem) {
      map.push({ key: [0x04], value: redeem });
      return map;
    }
  }
  if (script.length === 23 && script[0] === 0xa9) {
    throw new Error(
      keys.length === 0
        ? "Your payment address is a nested-segwit (3…) address and the wallet did not share its public key — reconnect the wallet and retry"
        : "Your wallet's public key does not match your nested-segwit (3…) payment address — switch to the account holding those funds, reconnect, and retry",
    );
  }
  if (isP2pkhScript(script)) {
    throw new Error(
      "Legacy (1…) payment addresses cannot fund this purchase — use a native segwit (bc1q…) or nested segwit (3…) payment address",
    );
  }
  return map;
}

const DUST = 546;

function estimateVsize(inputs: number, outputs: number): number {
  return Math.ceil(11 + inputs * 58 + outputs * 43);
}

/** Where the seller's input and payment output sit in every purchase. */
export const SELLER_INDEX = 2;

/**
 * Builds the complete purchase PSBT with ordinal-safe sat flow.
 *
 * Sats leave a transaction first-in first-out, so the BITMAP (first sat of the
 * seller's input) lands in whichever output covers that offset. Two plain buyer
 * "padding" coins go first and come straight back in output 0, which puts the
 * BITMAP at the very start of output 1 (the buyer's ordinals address). The
 * seller's SIGHASH_SINGLE|ANYONECANPAY signature does not commit to its input
 * index, so the seller input and its price output both move to index 2.
 *
 * inputs : [pad, pad, seller, funding…]
 * outputs: [pads → buyer, BITMAP → buyer, price → seller, market fee, tribute?, change?]
 */
export function buildBuyerPsbt(input: BuyerPsbtInput): BuyerPsbtResult {
  const seller = parsePsbt(input.sellerPsbtBase64);
  const [txidHex, voutRaw] = input.inscriptionOutpoint.split(":");
  if (!txidHex || voutRaw === undefined) throw new Error("Bad inscription outpoint");
  const vout = Number(voutRaw);
  const txidLe = hexToByteArray(txidHex).reverse();

  const sellerIndex = seller.tx.inputs.findIndex(
    (i) => byteArrayToHex(i.txidLe) === byteArrayToHex(txidLe) && i.vout === vout,
  );
  if (sellerIndex === -1) throw new Error("The offer PSBT does not spend the listed inscription");
  if (sellerIndex !== 0 || seller.tx.inputs.length !== 1 || seller.tx.outputs.length !== 1) {
    throw new Error("Unsupported offer: expected one inscription input and one price output");
  }
  const priceOutput = seller.tx.outputs[0]!;
  const priceSats = priceOutput.valueSats;

  const receiveScript = hexToByteArray(input.receiveScriptHex);
  const changeScript = hexToByteArray(input.changeScriptHex);
  const tapKey =
    input.tapInternalKeyHex && /^[0-9a-f]{64}$/i.test(input.tapInternalKeyHex)
      ? hexToByteArray(input.tapInternalKeyHex)
      : null;

  const marketFeeSats = marketplaceFeeSats(priceSats);
  const marketFeeScript = addressToScriptPubKey(MARKETPLACE_FEE_ADDRESS);
  const landTribute =
    input.landTribute && input.landTribute.sats >= DUST ? input.landTribute : undefined;
  const landTributeSats = landTribute?.sats ?? 0;
  // Old inscriptions often sit on sub-dust postage; the buyer tops output 1 up to dust.
  const inscriptionOutputSats = Math.max(input.inscriptionValueSats, DUST);
  const inscriptionTopUpSats = inscriptionOutputSats - input.inscriptionValueSats;

  const plain = input.funding.filter((u) => u.valueSats >= DUST);
  if (plain.length < 3) {
    throw new Error(
      "Your payment address needs at least 3 separate plain coins: two small ones keep the BITMAP from flowing to the seller. Send yourself two payments of 600 sats, wait for them to confirm, and retry",
    );
  }
  const ascending = [...plain].sort((a, b) => a.valueSats - b.valueSats);
  const pads = ascending.slice(0, 2);
  const padSats = pads[0]!.valueSats + pads[1]!.valueSats;
  const candidates = ascending.slice(2).reverse(); // largest first

  const fixedOutputs = 4 + (landTribute ? 1 : 0); // pads, BITMAP, price, fee, tribute?
  const used: FundingUtxo[] = [];
  let funded = 0;
  let feeSats = 0;
  let needed = 0;
  for (const candidate of candidates) {
    used.push(candidate);
    funded += candidate.valueSats;
    feeSats = Math.ceil(estimateVsize(3 + used.length, fixedOutputs + 1) * Math.max(1, input.feeRate));
    needed = priceSats + marketFeeSats + landTributeSats + inscriptionTopUpSats + feeSats;
    if (funded >= needed + DUST) break;
  }
  if (funded < needed) {
    throw new Error(`Not enough confirmed funds: need ~${needed} sats plus fees, have ${funded}`);
  }

  let changeSats = funded - needed;
  if (changeSats < DUST) {
    feeSats += changeSats;
    changeSats = 0;
  }

  const toInput = (u: FundingUtxo) => ({ txidLe: hexToByteArray(u.txid).reverse(), vout: u.vout, sequence: 0xfffffffd });
  const tx: RawTx = {
    version: seller.tx.version || 2,
    locktime: 0,
    inputs: [toInput(pads[0]!), toInput(pads[1]!), seller.tx.inputs[0]!, ...used.map(toInput)],
    outputs: [
      { valueSats: padSats, script: changeScript },
      { valueSats: inscriptionOutputSats, script: receiveScript },
      priceOutput,
      { valueSats: marketFeeSats, script: marketFeeScript },
      ...(landTribute ? [{ valueSats: landTributeSats, script: hexToByteArray(landTribute.scriptHex) }] : []),
      ...(changeSats > 0 ? [{ valueSats: changeSats, script: changeScript }] : []),
    ],
  };

  const fundingMap = (u: FundingUtxo) => fundingInputMap(u, tapKey, input.paymentPublicKeyHex);
  const inputMaps: Kv[][] = [fundingMap(pads[0]!), fundingMap(pads[1]!), seller.inputs[0] ?? [], ...used.map(fundingMap)];
  const outputMaps: Kv[][] = tx.outputs.map((_, i) => (i === SELLER_INDEX ? (seller.outputs[0] ?? []) : []));

  const psbtBase64 = serializePsbt({
    global: seller.global.filter((kv) => kv.key[0] === 0x00),
    inputs: inputMaps,
    outputs: outputMaps,
    tx,
  });

  return {
    psbtBase64,
    signIndices: [0, 1, ...used.map((_, i) => i + 3)],
    priceSats,
    feeSats,
    marketFeeSats,
    landTributeSats,
    changeSats,
    spentSats: priceSats + marketFeeSats + landTributeSats + inscriptionTopUpSats + feeSats,
    usedFunding: [...pads, ...used],
  };
}

/**
 * Follows the sats: index of the output that receives the first sat of
 * `inputIndex`, or null when it would go to fees. Input values come from each
 * input's witness/non-witness UTXO record, or `knownValues` when given.
 */
export function satDestination(psbtBase64: string, inputIndex: number, knownValues?: number[]): number | null {
  const psbt = parsePsbt(psbtBase64);
  const valueOf = (i: number): number => {
    if (knownValues?.[i] !== undefined) return knownValues[i]!;
    const w = psbt.inputs[i]?.find((kv) => kv.key.length === 1 && kv.key[0] === 0x01)?.value;
    if (w) {
      let v = 0;
      for (let k = 0; k < 8; k++) v += w[k]! * 2 ** (8 * k);
      return v;
    }
    const nw = psbt.inputs[i]?.find((kv) => kv.key.length === 1 && kv.key[0] === 0x00)?.value;
    if (nw) {
      const prev = parseTx(nw);
      const out = prev.outputs[psbt.tx.inputs[i]!.vout];
      if (out) return out.valueSats;
    }
    throw new Error(`Input ${i} has no UTXO value`);
  };
  let offset = 0;
  for (let i = 0; i < inputIndex; i++) offset += valueOf(i);
  let end = 0;
  for (let o = 0; o < psbt.tx.outputs.length; o++) {
    end += psbt.tx.outputs[o]!.valueSats;
    if (offset < end) return o;
  }
  return null;
}

export type PaymentPsbtInput = {
  /** confirmed funding UTXOs of the payer's payment address */
  funding: FundingUtxo[];
  /** scriptPubKey of the payer's address (change + inputs) */
  payerScriptHex: string;
  /** ordered payment outputs, address + amount */
  outputs: { scriptHex: string; valueSats: number }[];
  /** sat/vB */
  feeRate: number;
  /** payer x-only taproot key, when the funding inputs are p2tr */
  tapInternalKeyHex?: string | undefined;
  /** payer compressed public key(s), required for nested-segwit (3…) inputs */
  paymentPublicKeyHex?: string | string[] | undefined;
};

export type PaymentPsbtResult = {
  psbtBase64: string;
  signIndices: number[];
  feeSats: number;
  changeSats: number;
  spentSats: number;
  usedFunding: FundingUtxo[];
};

/**
 * Builds a plain payment PSBT from the payer's own confirmed UTXOs. Used for
 * rent payments: every output is an explicit recipient, change returns to the
 * payer, and the payer signs every input.
 */
export function buildPaymentPsbt(input: PaymentPsbtInput): PaymentPsbtResult {
  const payScript = hexToByteArray(input.payerScriptHex);
  const outputs = input.outputs.map((o) => ({
    valueSats: o.valueSats,
    script: hexToByteArray(o.scriptHex),
  }));
  const target = outputs.reduce((sum, o) => sum + o.valueSats, 0);
  if (target <= 0) throw new Error("Payment amount must be positive");

  const tapKey =
    input.tapInternalKeyHex && /^[0-9a-f]{64}$/i.test(input.tapInternalKeyHex)
      ? hexToByteArray(input.tapInternalKeyHex)
      : null;

  const candidates = [...input.funding]
    .filter((u) => u.valueSats > DUST)
    .sort((a, b) => b.valueSats - a.valueSats);

  const used: FundingUtxo[] = [];
  let funded = 0;
  let feeSats = 0;
  let needed = 0;
  for (const candidate of candidates) {
    used.push(candidate);
    funded += candidate.valueSats;
    feeSats = Math.ceil(
      estimateVsize(used.length, outputs.length + 1) * Math.max(1, input.feeRate),
    );
    needed = target + feeSats;
    if (funded >= needed + DUST) break;
  }
  if (used.length === 0 || funded < needed) {
    throw new Error(
      `Not enough confirmed funds: need ~${target + feeSats} sats, have ${funded}`,
    );
  }

  let changeSats = funded - target - feeSats;
  if (changeSats < DUST) {
    feeSats += changeSats;
    changeSats = 0;
  }

  const tx: RawTx = {
    version: 2,
    locktime: 0,
    inputs: used.map((u) => ({
      txidLe: hexToByteArray(u.txid).reverse(),
      vout: u.vout,
      sequence: 0xfffffffd,
    })),
    outputs: [...outputs, ...(changeSats > 0 ? [{ valueSats: changeSats, script: payScript }] : [])],
  };

  const inputMaps: Kv[][] = used.map((utxo) =>
    fundingInputMap(utxo, tapKey, input.paymentPublicKeyHex),
  );

  const psbtBase64 = serializePsbt({
    // serializePsbt inserts the mandatory BIP-174 unsigned transaction entry.
    global: [],
    inputs: inputMaps,
    outputs: tx.outputs.map(() => []),
    tx,
  });

  return {
    psbtBase64,
    signIndices: used.map((_, i) => i),
    feeSats,
    changeSats,
    spentSats: target + feeSats,
    usedFunding: used,
  };
}

/* ── BW-BARTER-1 atomic swap ─────────────────────────────────────────── */

export type SwapPsbtInput = {
  maker: { txid: string; vout: number; valueSats: number; scriptPubKeyHex: string };
  taker: { txid: string; vout: number; valueSats: number; scriptPubKeyHex: string };
  /** further taker items for an N-for-1 bundle (each goes to the maker at equal value) */
  moreTakers?: { txid: string; vout: number; valueSats: number; scriptPubKeyHex: string }[];
  makerReceiveScriptHex: string;
  takerReceiveScriptHex: string;
  takerChangeScriptHex: string;
  funding: FundingUtxo[];
  feeRate: number;
  /** taker-paid sats to the maker (0 = none) */
  sweetenerSats: number;
  takerTapKeyHex?: string | undefined;
  takerPaymentTapKeyHex?: string | undefined;
  takerPublicKeyHex?: string | string[] | undefined;
};

export type SwapPsbtResult = {
  psbtBase64: string;
  feeSats: number;
  changeSats: number;
  /** indices signed by the taker's ordinals key (the matched asset) */
  takerAssetIndex: number;
  /** every taker item input (1..N) */
  takerAssetIndices: number[];
  /** indices signed by the taker's payment key (fee funding) */
  fundingIndices: number[];
};

const tapKeyOf = (hex: string | undefined): number[] | null => {
  if (!hex) return null;
  const h = hex.length === 66 ? hex.slice(2) : hex;
  return /^[0-9a-f]{64}$/i.test(h) ? hexToByteArray(h) : null;
};

/**
 * Builds the unsigned BW-BARTER-1 swap. Both parties sign SIGHASH_ALL, so no
 * input or output can change after either signature.
 * inputs : [maker asset, taker asset, taker funding…]
 * outputs: [maker asset → taker, taker asset → maker, sweetener → maker?, change → taker?]
 * Each asset sits on sat 0 of its input and output, and every earlier output
 * has the same value as its input, so FIFO sat flow carries each inscription intact.
 */
export function buildSwapPsbt(input: SwapPsbtInput): SwapPsbtResult {
  const takers = [input.taker, ...(input.moreTakers ?? [])];
  const N = takers.length;
  const outs = [
    { valueSats: input.maker.valueSats, script: hexToByteArray(input.takerReceiveScriptHex) },
    ...takers.map((t) => ({ valueSats: t.valueSats, script: hexToByteArray(input.makerReceiveScriptHex) })),
  ];
  if (input.sweetenerSats > 0) {
    if (input.sweetenerSats < DUST) throw new Error("Sweetener below dust");
    outs.push({ valueSats: input.sweetenerSats, script: hexToByteArray(input.makerReceiveScriptHex) });
  }
  const used: FundingUtxo[] = [];
  let funded = 0;
  let feeSats = 0;
  const candidates = [...input.funding].filter((u) => u.valueSats > DUST).sort((a, b) => b.valueSats - a.valueSats);
  for (const c of candidates) {
    used.push(c);
    funded += c.valueSats;
    feeSats = Math.ceil(estimateVsize(1 + N + used.length, outs.length + 1) * Math.max(1, input.feeRate));
    if (funded >= feeSats + input.sweetenerSats + DUST) break;
  }
  if (used.length === 0 || funded < feeSats + input.sweetenerSats) {
    throw new Error(`Not enough confirmed funds for the fee: need ~${feeSats + input.sweetenerSats} sats, have ${funded}`);
  }
  let changeSats = funded - feeSats - input.sweetenerSats;
  if (changeSats < DUST) { feeSats += changeSats; changeSats = 0; }
  if (changeSats > 0) outs.push({ valueSats: changeSats, script: hexToByteArray(input.takerChangeScriptHex) });

  const asIn = (u: { txid: string; vout: number }) => ({ txidLe: hexToByteArray(u.txid).reverse(), vout: u.vout, sequence: 0xfffffffd });
  const tx: RawTx = { version: 2, locktime: 0, inputs: [asIn(input.maker), ...takers.map(asIn), ...used.map(asIn)], outputs: outs };
  const makerScript = hexToByteArray(input.maker.scriptPubKeyHex);
  const inputs: Kv[][] = [
    [{ key: [0x01], value: [...u64le(input.maker.valueSats), ...varint(makerScript.length), ...makerScript] }],
    ...takers.map((t) => fundingInputMap({ ...t }, tapKeyOf(input.takerTapKeyHex), input.takerPublicKeyHex)),
    ...used.map((u) => fundingInputMap(u, tapKeyOf(input.takerPaymentTapKeyHex ?? input.takerTapKeyHex), input.takerPublicKeyHex)),
  ];
  const psbtBase64 = serializePsbt({ global: [], inputs, outputs: tx.outputs.map(() => []), tx });
  return { psbtBase64, feeSats, changeSats, takerAssetIndex: 1, takerAssetIndices: takers.map((_, i) => i + 1), fundingIndices: used.map((_, i) => i + 1 + N) };
}

/** Adds the maker's signing hints (taproot internal key / P2SH redeem script) to input 0 before the maker signs. */
export function prepareMakerInput(psbtBase64: string, tapKeyHex?: string, publicKeyHex?: string | string[]): string {
  const psbt = parsePsbt(psbtBase64);
  const map = psbt.inputs[0];
  if (!map) throw new Error("Swap has no maker input");
  const wu = map.find((kv) => kv.key.length === 1 && kv.key[0] === 0x01);
  if (!wu) throw new Error("Maker input has no witness UTXO");
  const value = wu.value.slice(0, 8).reduce((s, b, i) => s + b * 2 ** (8 * i), 0);
  const script = wu.value.slice(9);
  const fresh = fundingInputMap(
    { txid: "00".repeat(32), vout: 0, valueSats: value, scriptPubKeyHex: byteArrayToHex(script) },
    tapKeyOf(tapKeyHex),
    publicKeyHex,
  );
  // Hints already on input 0 came from the taker; replace them with the maker's own checked keys.
  psbt.inputs[0] = [...map.filter((kv) => kv.key[0] !== 0x17 && kv.key[0] !== 0x04), ...fresh.filter((kv) => kv.key[0] !== 0x01)];
  return serializePsbt(psbt);
}
