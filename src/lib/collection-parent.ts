/**
 * The one BITMAPWIN collection parent (browser-safe). Verified on ordinals.com:
 * inscription #127,507,146, block 969,569, text/html, with real children.
 * NOTE: #127,517,786 (Guardian V7) is a Tag 11 delegate, never a parent.
 */
export const MASTER_PARENT_ID = "9d1da99caec6afbf69b89bdafdc0a7ab679c6dd67920f7b38d3a3fd116d0e21fi0";
export const MASTER_PARENT_NUMBER = 127_507_146;
export const MASTER_DELEGATE_NUMBER = 127_517_786;

/** Children proven by ordinals.com right now (paged). Null = could not check. */
export async function provenChildren(id = MASTER_PARENT_ID): Promise<string[] | null> {
  const out: string[] = [];
  try {
    for (let page = 0; page < 20; page++) {
      const r = await fetch(`https://ordinals.com/r/children/${id}/${page}`, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) return null;
      const d = (await r.json()) as { ids?: string[]; more?: boolean };
      out.push(...(d.ids ?? []));
      if (!d.more) break;
    }
    return out;
  } catch { return null; }
}
