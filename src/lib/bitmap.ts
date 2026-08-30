export type BitmapStatus = "for_sale" | "owned" | "unclaimed";

export type Bitmap = {
  id: string;
  block_height: number;
  inscription_id: string | null;
  owner_address: string | null;
  status: BitmapStatus;
  price_btc: number | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityEvent = {
  id: string;
  type: string;
  bitmap_id: string | null;
  wallet_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  block_height?: number | null;
};

export const STATUS_LABEL: Record<BitmapStatus, string> = {
  for_sale: "FOR SALE",
  owned: "OWNED",
  unclaimed: "UNCLAIMED",
};

/** Deterministic 32-bit hash of a block height. */
function hash32(seed: number): number {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic black/white pixel pattern for a block height.
 * Grid size is between 8x8 and 16x16, mirrored for a sigil-like identity.
 */
export function bitmapPattern(blockHeight: number): {
  size: number;
  cells: boolean[];
} {
  const h = hash32(blockHeight);
  const size = 8 + (h % 5) * 2; // 8, 10, 12, 14, 16
  const rand = mulberry32(h);
  const half = Math.ceil(size / 2);
  const density = 0.34 + (h % 23) / 100; // 0.34 - 0.56
  const cells = new Array<boolean>(size * size).fill(false);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < half; x++) {
      const on = rand() < density;
      cells[y * size + x] = on;
      cells[y * size + (size - 1 - x)] = on;
    }
  }
  return { size, cells };
}

export function formatBtc(price: number | null | undefined): string {
  if (price === null || price === undefined) return "—";
  return `${price.toFixed(3)} BTC`;
}

export function shortAddress(address: string | null | undefined): string {
  if (!address) return "UNCLAIMED";
  return address;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} MINUTE${minutes === 1 ? "" : "S"} AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} HOUR${hours === 1 ? "" : "S"} AGO`;
  const days = Math.round(hours / 24);
  return `${days} DAY${days === 1 ? "" : "S"} AGO`;
}
