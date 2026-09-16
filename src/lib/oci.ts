// Shared types/constants for the OCI (on-chain index) bitmap registry.
// The index itself lives on Bitcoin as eleven inscriptions: each page maps a
// bitmap number to the sat that carries its claim, delta encoded. The module
// that stitches them together is
// 942b5886158d57fc70cb8fb7d9bd4d37aa95b8b145be1a351326336b087262dbi0
// (0 … 941999.bitmap, second post-840k addition).

export const PAGE_SIZE = 100_000;
export const MAX_BITMAP = 941_999;
export const PAGE9_START = 840_000;
export const PAGE10_START = 907_000;

/**
 * Inscription ids of the OCI pages, page 0..10. Page 9 covers 840000–906999
 * and page 10 covers 907000–941999; both ship as JSON with their own
 * satIndexMap.
 */
export const OCI_PAGES = [
  "01bba6c58af39d7f199aa2bceeaaba1ba91b23d2663bc4ef079a4b5e442dbf74i0",
  "bb01dfa977a5cd0ee6e900f1d1f896b5ec4b1e3c7b18f09c952f25af6591809fi0",
  "bb02e94f3062facf6aa2e47eeed348d017fd31c97614170dddb58fc59da304efi0",
  "bb037ec98e6700e8415f95d1f5ca1fe1ba23a3f0c5cb7284d877e9ac418d0d32i0",
  "bb9438f4345f223c6f4f92adf6db12a82c45d1724019ecd7b6af4fcc3f5786cei0",
  "bb0542d4606a9e7eb4f31051e91f7696040db06ca1383dff98505618c34d7df7i0",
  "bb06a4dffba42b6b513ddee452b40a67688562be4a1345127e4d57269e6b2ab6i0",
  "bb076934c1c22007b315dd1dc0f8c4a2f9d52f348320cfbadc7c0bd99eaa5e18i0",
  "bb986a1208380ec7db8df55a01c88c73a581069a51b5a2eb2734b41ba10b65c2i0",
  "b907b51a239e3a37f29f8222fb274f828c6ebf7b93ce501a55b7171daaa75758i0",
  "b942b6477c7da9090edb9751429ba9c3ba01b39ab972fc888d481f528e3e03c3i0",
] as const;

/**
 * Sat-index overrides for pre-840000 bitmaps whose claim is not the first
 * inscription on its sat (page 9 ships its own satIndexMap).
 */
export const LEGACY_SAT_INDICES: Record<number, number> = {
  92871: 1, 92970: 1, 123132: 1, 365518: 1, 700181: 1, 826151: 1, 827151: 1,
  828151: 1, 828239: 1, 828661: 1, 829151: 1, 830151: 1, 832104: 2, 832249: 2,
  832252: 2, 832385: 4, 833067: 1, 833101: 3, 833105: 4, 833109: 4, 833121: 8,
  834030: 2, 834036: 2, 834051: 17, 834073: 4, 836151: 1, 837115: 2, 837120: 2,
  837151: 1, 837183: 3, 837188: 2, 838058: 5, 838068: 2, 838076: 2, 838096: 1,
  838151: 1, 838821: 1, 839151: 1, 839377: 1, 839378: 2, 839382: 2, 839397: 1,
  840151: 1, 841151: 1, 842151: 1, 845151: 1,
};

export type BitmapIndexEntry = {
  blockHeight: number;
  sat: number;
  satIndex: number;
  inscriptionId: string | null;
  content: string | null;
  isValid: boolean;
  genesisHeight: number | null;
  ownerAddress: string | null;
  resolvedAt: string | null;
};

export function pageForBitmap(height: number): number {
  if (height >= PAGE10_START) return 10;
  if (height >= PAGE9_START) return 9;
  return Math.floor(height / PAGE_SIZE);
}

/** Public URL that serves an inscription's raw content. */
export function ordContentUrl(inscriptionId: string): string {
  return `https://ordinals.com/content/${inscriptionId}`;
}

export function isValidClaimContent(height: number, content: string | null): boolean {
  if (!content) return false;
  return content.trim() === `${height}.bitmap`;
}
