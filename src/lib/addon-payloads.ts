/**
 * Child add-on payloads read by the Guardian Master V8 (BW-MOD-1, BW-PAGE-1, BW-SKIN-1, BW-BEACON-1).
 * Pure builders: the exact text the Master parses, plus the problems that would make it ignore the child.
 */
export type AddonKind = "mod" | "page" | "skin" | "beacon";

const ID_RE = /^[0-9a-f]{64}i\d+$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
/** Master reads PAGE/SKIN children only up to this many characters. */
export const ADDON_TEXT_LIMIT = 4000;

export type AddonResult = { text: string; problems: string[] };

export function isInscriptionId(s: string) {
  return ID_RE.test(s.trim());
}

export function buildMod(i: { id: string; label: string; goal: number; code: string }): AddonResult {
  const problems: string[] = [];
  const id = i.id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!id) problems.push("MODULE NEEDS AN ID");
  if (!i.code.trim()) problems.push("MODULE NEEDS CODE");
  const goal = Math.max(0, Math.floor(i.goal || 0));
  const man = JSON.stringify({ id, label: i.label.trim() || id, goal });
  return { text: `BW-MOD-1\n${man}\n${i.code.trim()}\n`, problems };
}

export type PageInput = {
  title: string; status: string; bio: string; likes: string; dislikes: string;
  top8: string; accent: string; x: string; pfp: string;
};

const list = (s: string, n: number, len: number) =>
  s.split(",").map((v) => v.trim().slice(0, len)).filter(Boolean).slice(0, n);

export function buildPage(i: PageInput): AddonResult {
  const problems: string[] = [];
  const o: Record<string, unknown> = {};
  if (i.title.trim()) o.title = i.title.trim().slice(0, 48);
  if (i.status.trim()) o.status = i.status.trim().slice(0, 64);
  if (i.bio.trim()) o.bio = i.bio.trim().slice(0, 280);
  const likes = list(i.likes, 6, 32); if (likes.length) o.likes = likes;
  const dislikes = list(i.dislikes, 6, 32); if (dislikes.length) o.dislikes = dislikes;
  const top = list(i.top8, 99, 80);
  const goodTop = top.filter((t) => ID_RE.test(t)).slice(0, 8);
  if (top.length !== goodTop.length) problems.push("SOME TOP 8 ENTRIES ARE NOT INSCRIPTION IDS (OR MORE THAN 8)");
  if (goodTop.length) o.top8 = goodTop;
  if (i.accent.trim()) { if (HEX_RE.test(i.accent.trim())) o.theme = { accent: i.accent.trim() }; else problems.push("ACCENT MUST LOOK LIKE #F7931A"); }
  const x = i.x.trim().replace(/^@/, "");
  if (x) { if (/^[A-Za-z0-9_]{1,15}$/.test(x)) o.socials = { x }; else problems.push("X HANDLE IS NOT VALID"); }
  if (i.pfp.trim()) { if (ID_RE.test(i.pfp.trim())) o.pfp = i.pfp.trim(); else problems.push("PROFILE IMAGE MUST BE AN INSCRIPTION ID"); }
  if (!Object.keys(o).length) problems.push("FILL IN AT LEAST ONE FIELD");
  const text = `BW-PAGE-1\n${JSON.stringify(o)}`;
  if (text.length > ADDON_TEXT_LIMIT) problems.push("PROFILE IS TOO LONG");
  return { text, problems };
}

export function buildSkin(i: { name: string; frame: string; mask: string; accent: string; scan: number }): AddonResult {
  const problems: string[] = [];
  const o: Record<string, unknown> = {};
  if (i.name.trim()) o.name = i.name.trim().slice(0, 32);
  for (const k of ["frame", "mask"] as const) {
    const v = i[k].trim();
    if (v) { if (ID_RE.test(v)) o[k] = v; else problems.push(`${k.toUpperCase()} MUST BE AN IMAGE INSCRIPTION ID`); }
  }
  if (!o.frame && !o.mask) problems.push("ADD A FRAME OR MASK IMAGE ID");
  if (i.accent.trim()) { if (HEX_RE.test(i.accent.trim())) o.accent = i.accent.trim(); else problems.push("ACCENT MUST LOOK LIKE #3FE0D0"); }
  o.scan = Math.min(1, Math.max(0, Math.round(i.scan * 100) / 100));
  return { text: `BW-SKIN-1\n${JSON.stringify(o)}`, problems };
}

const BEACON_RE = /^(sp1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{100,120}|bc1p[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}|bc1q[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38})$/;
export function buildBeacon(addr: string): AddonResult {
  const a = addr.trim();
  return { text: `BW-BEACON-1 ${a}`, problems: BEACON_RE.test(a) ? [] : ["USE AN sp1…, bc1p… OR bc1q… ADDRESS"] };
}
