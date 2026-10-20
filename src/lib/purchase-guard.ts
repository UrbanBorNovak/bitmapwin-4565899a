/** Why a listing can no longer be bought at the price the buyer saw, or null if it still can. */
export function listingChangeReason(
  expectedPriceSats: number | undefined,
  current: { status: string; priceSats: number },
): string | null {
  if (current.status !== "open") return current.status === "spent" ? "This BITMAP has already sold" : "This listing is no longer open";
  if (expectedPriceSats === undefined) return "Price check missing — reload and try again";
  if (current.priceSats !== expectedPriceSats)
    return `The price changed from ${expectedPriceSats.toLocaleString()} to ${current.priceSats.toLocaleString()} sats — reload to see the new price`;
  return null;
}
