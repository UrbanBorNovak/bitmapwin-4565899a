// BW-ROOMS-1 landowner proof: the BITMAP holder signs ONE BIP-322 message that
// delegates a block room's device-held Nostr key. Each message then carries
// ["proof", address, signature, issuedAt]. Readers re-check the signature and
// the live on-chain holder; a missing or failing proof shows as a plain visitor.
export const PROOF_TTL_S = 24 * 3600;

export const landownerMessage = (height: number, address: string, pubkey: string, issuedAt: number) =>
  `bitmapwin.app BW-ROOMS-1: I hold ${height}.bitmap at ${address} and delegate room chat to nostr ${pubkey}, issued ${issuedAt}`;

export type RoomProof = { address: string; signature: string; issuedAt: number };

export function proofTag(p: RoomProof): string[] {
  return ["proof", p.address, p.signature, String(p.issuedAt)];
}

export function readProofTag(tags: string[][]): RoomProof | null {
  const t = tags.find((x) => x[0] === "proof");
  if (!t || t.length < 4) return null;
  const issuedAt = Number(t[3]);
  if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(t[1] ?? "") || !t[2] || t[2].length > 400 || !Number.isInteger(issuedAt)) return null;
  return { address: t[1]!, signature: t[2]!, issuedAt };
}

/** Age check shared by client cache and server: future-dated or older than 24h is refused. */
export function proofFresh(issuedAt: number, nowS: number): boolean {
  return issuedAt <= nowS + 120 && nowS - issuedAt <= PROOF_TTL_S;
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
