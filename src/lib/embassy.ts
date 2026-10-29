/** Collection Embassies: shared, browser-safe constants. Holder proof lives only on the server. */
export const EMBASSY_TTL_MS = 5 * 60_000;

export function embassyMessage(collection: string, address: string, issuedAt: string): string {
  return [
    `BITMAPWIN EMBASSY — ENTER THE ${collection.toUpperCase()} HALL`,
    `ADDRESS: ${address}`,
    `ISSUED: ${issuedAt}`,
    "THIS SIGNATURE MOVES NO FUNDS AND COSTS NO FEE.",
  ].join("\n");
}
