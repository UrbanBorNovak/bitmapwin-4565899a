/** Message the Guardian's current holder signs to bind a deposit to a sealed note. */
export function depositMessage(inscriptionId: string, commitment: string) {
  return `BITMAPWIN SHIELDED POOL DEPOSIT\ninscription: ${inscriptionId}\nnote: ${commitment}`;
}

export type PoolNoteRecord = {
  inscriptionId: string;
  assetId: string;
  salt: string;
  commitment: string;
  status: "awaiting" | "shielded" | "spent";
  idx?: number;
};

const KEY = "bitmapwin:shord-pool-notes";

export function loadPoolNotes(): PoolNoteRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PoolNoteRecord[];
  } catch {
    return [];
  }
}

export function savePoolNotes(notes: PoolNoteRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(notes));
}

/** One-time code handed to a recipient so their device can later spend the note. */
export function encodeNoteGift(n: Pick<PoolNoteRecord, "inscriptionId" | "assetId" | "salt" | "commitment">) {
  return `SHORD-NOTE-v1.${btoa(JSON.stringify([n.inscriptionId, n.assetId, n.salt, n.commitment]))}`;
}

export function decodeNoteGift(code: string): Omit<PoolNoteRecord, "status"> | null {
  try {
    const raw = code.trim();
    if (!raw.startsWith("SHORD-NOTE-v1.")) return null;
    const [inscriptionId, assetId, salt, commitment] = JSON.parse(atob(raw.slice(14))) as string[];
    if (!inscriptionId || !assetId || !salt || !commitment) return null;
    return { inscriptionId, assetId, salt, commitment };
  } catch {
    return null;
  }
}
