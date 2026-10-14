import { EMPORIUM_HEIGHT, EMPORIUM_PARENT, type EmporiumResidency } from "@/lib/emporium";

/**
 * Bitmap Emporium residency, read only from chain via ordinals.com:
 * a Resident portrait is an image inscription whose Tag 3 parent is
 * 717328.bitmap and which currently sits at the address; a valid parcel of
 * 717328 also counts. Nothing is trusted from the browser.
 */
const ORD = "https://ordinals.com";
const ID_RE = /^[0-9a-f]{64}i\d+$/;
const ADDR_RE = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/;

async function json<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${ORD}${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function addressInscriptions(address: string): Promise<string[]> {
  const body = await json<{ inscriptions?: unknown }>(`/address/${address}`);
  const list = Array.isArray(body?.inscriptions) ? body!.inscriptions : [];
  return [...new Set(list.filter((x): x is string => typeof x === "string" && ID_RE.test(x)))].slice(0, 400);
}

async function isPortrait(id: string): Promise<boolean> {
  const meta = await json<{ parents?: unknown; content_type?: string | null }>(`/r/inscription/${id}`);
  if (!meta) return false;
  const parents = Array.isArray(meta.parents) ? meta.parents : [];
  return parents.includes(EMPORIUM_PARENT) && Boolean(meta.content_type?.toLowerCase().startsWith("image/"));
}

export async function verifyEmporiumResident(address: string): Promise<EmporiumResidency> {
  const wanted = address.trim();
  const empty: EmporiumResidency = { address: wanted, height: EMPORIUM_HEIGHT, resident: false, portraits: [], parcels: [], checkedAt: new Date().toISOString() };
  if (!ADDR_RE.test(wanted)) return empty;

  const [ids, parcels] = await Promise.all([
    addressInscriptions(wanted),
    (async () => {
      try {
        const { scanParcels } = await import("@/lib/parcels.server");
        const scan = await scanParcels(EMPORIUM_HEIGHT, EMPORIUM_PARENT);
        return scan.parcels.filter((p) => p.valid && p.ownerAddress === wanted).map((p) => ({ index: p.index, inscriptionId: p.inscriptionId }));
      } catch {
        return [] as { index: number; inscriptionId: string }[];
      }
    })(),
  ]);

  const portraits: string[] = [];
  for (let i = 0; i < ids.length && portraits.length < 24; i += 10) {
    const batch = ids.slice(i, i + 10);
    const hits = await Promise.all(batch.map(isPortrait));
    batch.forEach((id, k) => { if (hits[k]) portraits.push(id); });
  }
  return { ...empty, resident: portraits.length > 0 || parcels.length > 0, portraits, parcels };
}
