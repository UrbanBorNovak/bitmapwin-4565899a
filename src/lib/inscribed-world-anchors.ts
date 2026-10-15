/**
 * Value-anchored Inscribed Worlds: some worlds are not children of a BITMAP
 * but name it through their output postage (value === height). We list the
 * known ones here and the server re-checks the live value on every lookup,
 * so a moved/re-postaged inscription drops off automatically.
 */
export const VALUE_ANCHORED_WORLDS: Record<number, string[]> = {
  422: ["fa66c1e1ef9e8d609cff0301806963eb966dfc98a72cbb2f9dedf3b831009381i0"],
};

/** The on-chain anchor rule: the inscription's current output value equals the BITMAP height. */
export function valueAnchors(value: number | null | undefined, height: number): boolean {
  return typeof value === "number" && Number.isInteger(height) && height >= 0 && value === height;
}
