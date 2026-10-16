// Port of the Bitmap on-chain index (OCI) sat cache module inscribed at
// /content/970c183ec1e8cb10d25e53140b520bbda5dcf4381d830ea4dfda507b9af4f926i0 (LiveOCI v1.1)
// Resolves the first-is-first inscription id of <height>.bitmap for 0–969,999.
import { OCI_ID_FIXES } from "@/lib/oci-fixes";
export const BITMAP_OCI_MODULE_ID = "970c183ec1e8cb10d25e53140b520bbda5dcf4381d830ea4dfda507b9af4f926i0";
export const BITMAP_OCI_MAX = 970_000;

const ORD = "https://ordinals.com";
const PAGES = [
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
  "970bd12900ff92a0e620cf08a7842c310b04d88335ae1c6a0d6b3b38bc377f51i0",
];
const SAT_INDICES: Record<number, number> = {92871:1,92970:1,123132:1,365518:1,700181:1,826151:1,827151:1,828151:1,828239:1,828661:1,829151:1,830151:1,832104:2,832249:2,832252:2,832385:4,833067:1,833101:3,833105:4,833109:4,833121:8,834030:2,834036:2,834051:17,834073:4,836151:1,837115:2,837120:2,837151:1,837183:3,837188:2,838058:5,838068:2,838076:2,838096:1,838151:1,838821:1,839151:1,839377:1,839378:2,839382:2,839397:1,840151:1,841151:1,842151:1,845151:1};

type Page = { sats: number[]; satIndex: Record<string, number> };
const cache = new Map<number, Promise<Page>>();

function undelta(d: Array<number | string>): number[] {
  const out: number[] = [];
  d.forEach((s, i) => out.push(i === 0 ? Number(s) : (out[i - 1] ?? 0) + Number(s)));
  return out;
}

async function loadPage(p: number): Promise<Page> {
  const r = await fetch(`${ORD}/content/${PAGES[p]}`);
  if (!r.ok) throw new Error("OCI page unavailable");
  if (p === 9 || p === 10 || p === 11) {
    const data = (await r.json()) as { deltaEncodedSats: Array<number | string>; satIndexMap: Record<string, number> };
    return { sats: undelta(data.deltaEncodedSats), satIndex: data.satIndexMap ?? {} };
  }
  let text = await r.text();
  let data: unknown;
  if (p === 2 || p === 3) {
    const flat = JSON.parse("[" + text + "]") as unknown[];
    data = [flat.slice(0, 99999), flat.slice(100000, 199999)];
  } else {
    data = text;
    try { data = JSON.parse(text.replaceAll("\\n  ", "")); } catch { /* keep */ }
    if (typeof data === "string") { try { data = JSON.parse((text = data).replaceAll("  ", "")); } catch { /* keep */ } }
    if (typeof data === "string") data = JSON.parse(data);
  }
  const [deltas, order] = data as [Array<number | string>, number[]];
  const full = undelta(deltas);
  const filled = new Array<number>(100000).fill(0);
  order.forEach((idx, i) => { filled[idx] = full[i] ?? 0; });
  return { sats: filled, satIndex: {} };
}

function page(p: number) {
  let v = cache.get(p);
  if (!v) { v = loadPage(p); cache.set(p, v); v.catch(() => cache.delete(p)); }
  return v;
}

/** Canonical inscription id for <height>.bitmap per the OCI, or null if out of range / unresolved. */
export async function ociBitmapInscriptionId(height: number): Promise<string | null> {
  if (!Number.isInteger(height) || height < 0 || height >= BITMAP_OCI_MAX) return null;
  const fixed = OCI_ID_FIXES[height];
  if (fixed) return fixed;
  const p = height >= 942000 ? 11 : height >= 907000 ? 10 : height >= 840000 ? 9 : Math.floor(height / 100000);
  const pg = await page(p);
  const off = height >= 942000 ? height - 942000 : height >= 907000 ? height - 907000 : height >= 840000 ? height - 840000 : height % 100000;
  const sat = pg.sats[off];
  if (!sat) return null;
  const at = height >= 840000 ? Number(pg.satIndex[String(height)] ?? 0) : SAT_INDICES[height] ?? 0;
  const r = await fetch(`${ORD}/r/sat/${sat}/at/${at}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { id?: string | null };
  return j.id ?? null;
}
