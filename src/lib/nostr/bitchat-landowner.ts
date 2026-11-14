// BW-ROOMS-1 holder proof: the BITMAP holder (or a parcel holder) signs ONE
// BIP-322 message that delegates a block room's device-held Nostr key. Each
// message then carries ["proof", address, signature, issuedAt, kind?]. Readers
// re-check the signature and live on-chain custody; a missing or failing proof
// shows as a plain visitor.
export const PROOF_TTL_S = 24 * 3600;

/** "land" = the canonical BITMAP holder; "parcel" = holder of valid parcel children. */
export type ProofKind = "land" | "parcel";

export const landownerMessage = (height: number, address: string, pubkey: string, issuedAt: number) =>
  `bitmapwin.app BW-ROOMS-1: I hold ${height}.bitmap at ${address} and delegate room chat to nostr ${pubkey}, issued ${issuedAt}`;

export const parcelHolderMessage = (height: number, address: string, pubkey: string, issuedAt: number) =>
  `bitmapwin.app BW-ROOMS-1: I hold parcels of ${height}.bitmap at ${address} and delegate room chat to nostr ${pubkey}, issued ${issuedAt}`;

export const roomProofMessage = (kind: ProofKind | undefined, height: number, address: string, pubkey: string, issuedAt: number) =>
  (kind === "parcel" ? parcelHolderMessage : landownerMessage)(height, address, pubkey, issuedAt);

export type RoomProof = { address: string; signature: string; issuedAt: number; kind?: ProofKind };

export function proofTag(p: RoomProof): string[] {
  const t = ["proof", p.address, p.signature, String(p.issuedAt)];
  return p.kind === "parcel" ? [...t, "parcel"] : t;
}

export function readProofTag(tags: string[][]): RoomProof | null {
  const t = tags.find((x) => x[0] === "proof");
  if (!t || t.length < 4) return null;
  const issuedAt = Number(t[3]);
  if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(t[1] ?? "") || !t[2] || t[2].length > 400 || !Number.isInteger(issuedAt)) return null;
  const p: RoomProof = { address: t[1]!, signature: t[2]!, issuedAt };
  if (t[4] === "parcel") p.kind = "parcel";
  return p;
}

/** Age check shared by client cache and server: future-dated or older than 24h is refused. */
export function proofFresh(issuedAt: number, nowS: number): boolean {
  return issuedAt <= nowS + 120 && nowS - issuedAt <= PROOF_TTL_S;
}

/**
 * Parcel indexes `address` holds right now: a valid parcel counts only when its
 * live holder lookup (not the cached scan owner) is exactly `address`.
 */
export function heldParcelIndexes(
  parcels: { index: number; inscriptionId: string }[],
  liveHolder: Record<string, string | null | undefined>,
  address: string,
): number[] {
  return [...new Set(parcels.filter((p) => liveHolder[p.inscriptionId] === address).map((p) => p.index))].sort((a, b) => a - b);
}

/** Badge text: `12.715093`, or `12.715093 +2` when more parcels are held. */
export function parcelBadgeLabel(indexes: number[], height: number): string {
  if (!indexes.length) return "";
  return `${indexes[0]}.${height}${indexes.length > 1 ? ` +${indexes.length - 1}` : ""}`;
}

const STORE = (h: number, pk: string) => `bitmap.room.proof.${h}.${pk}`;
export function loadRoomProof(height: number, pubkey: string): RoomProof | null {
  try {
    const p = JSON.parse(localStorage.getItem(STORE(height, pubkey)) ?? "null") as RoomProof | null;
    return p && proofFresh(p.issuedAt, Math.floor(Date.now() / 1000)) ? p : null;
  } catch { return null; }
}
export function saveRoomProof(height: number, pubkey: string, p: RoomProof | null) {
  if (p) localStorage.setItem(STORE(height, pubkey), JSON.stringify(p));
  else localStorage.removeItem(STORE(height, pubkey));
}
