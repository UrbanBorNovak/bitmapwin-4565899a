/**
 * BW-SLAB-1 certificate child. A graded slab is inscribed as a Tag 3 child of
 * `<height>.bitmap` (plus the BITMAPWIN master collection, like Guardians and
 * Land Forge builds), carried on a 330-sat Taproot output. The body is a tiny
 * self-rendering HTML card with its facts in a machine-readable meta tag, so
 * any viewer can re-derive the grade from the block and compare.
 *
 * The grade is a BitmapWIN rubric, not a property of the BITMAP itself.
 */
import type { SlabGrade } from "@/lib/land-slab";
import { DONATION_ADDRESS } from "@/lib/donations";

/** Taproot (P2TR) dust limit: the smallest output Bitcoin Core relays for bc1p. */
export const SLAB_POSTAGE = 330;
/** Grading fee per BITMAP, paid inside the reveal to the treasury. Placeholder until set. */
export const SLAB_GRADING_FEE_SATS = 2_100;
export const SLAB_TREASURY = DONATION_ADDRESS;
export const SLAB_PROTOCOL = "BW-SLAB-1";

export type SlabCertFacts = {
  p: typeof SLAB_PROTOCOL;
  h: number;
  hash: string | null;
  tx: number;
  grade: number;
  name: string;
  subs: Record<string, number>;
  cert: string;
};

export function certFacts(height: number, txCount: number, hash: string | null, g: SlabGrade): SlabCertFacts {
  return {
    p: SLAB_PROTOCOL,
    h: height,
    hash,
    tx: txCount,
    grade: g.grade,
    name: g.name,
    subs: Object.fromEntries(g.subs.map((s) => [s.key, s.score])),
    cert: g.cert,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Self-contained certificate card; no network access needed to render. */
export function slabCertHtml(f: SlabCertFacts): string {
  const json = esc(JSON.stringify(f));
  const subs = Object.entries(f.subs).map(([k, v]) => `<li>${esc(k.toUpperCase())}<b>${v}</b></li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="bw-slab" content="${json}"><title>${f.h}.bitmap ${esc(f.name)} ${f.grade}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b11;font:14px monospace;color:#111}.s{width:300px;border:10px solid #c8102e;background:#f7f5f0;padding:16px}h1{font:bold 22px sans-serif;margin:0}.g{font:bold 40px sans-serif;color:#c8102e}ul{list-style:none;padding:0}li{display:flex;justify-content:space-between}small{color:#555}</style></head><body><div class="s"><h1>${f.h}.BITMAP</h1><div class="g">${esc(f.name)} ${f.grade}</div><ul>${subs}</ul><div>CERT ${esc(f.cert)}</div><small>${SLAB_PROTOCOL} · BitmapWIN rubric from block facts, not an on-chain property.</small></div></body></html>`;
}

/** Reads the facts back out of an inscribed certificate. Null when it isn't one. */
export function parseSlabCert(html: string): SlabCertFacts | null {
  const m = html.match(/<meta name="bw-slab" content="([^"]*)">/);
  if (!m) return null;
  try {
    const raw = m[1].replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    const f = JSON.parse(raw) as SlabCertFacts;
    if (f.p !== SLAB_PROTOCOL || !Number.isInteger(f.h) || !Number.isInteger(f.grade)) return null;
    return f;
  } catch {
    return null;
  }
}

/** Total a holder pays for one slab before miner fees. */
export const slabBaseCost = () => SLAB_POSTAGE + SLAB_GRADING_FEE_SATS;

/** Nostr kind-1 note text for a set of slabs. */
export function nostrNote(slabs: { h: number; name: string; grade: number; cert: string }[], albumUrl: string): string {
  const lines = slabs.slice(0, 12).map((s) => `• ${s.h}.bitmap — ${s.name} ${s.grade} (${s.cert})`);
  return [`My graded BITMAP land slabs:`, ...lines, "", albumUrl, "", "#bitcoin #bitmap #ordinals #landslab"].join("\n");
}
