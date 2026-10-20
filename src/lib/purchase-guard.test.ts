import { describe, expect, it } from "vitest";
import { listingChangeReason } from "./purchase-guard";
describe("buy-page revalidation", () => {
  it("allows only an open listing at the exact price seen", () => {
    expect(listingChangeReason(100000, { status: "open", priceSats: 100000 })).toBeNull();
  });
  it("blocks a changed price", () => {
    expect(listingChangeReason(100000, { status: "open", priceSats: 120000 })).toContain("price changed");
  });
  it("blocks sold and cancelled listings", () => {
    expect(listingChangeReason(100000, { status: "spent", priceSats: 100000 })).toBe("This BITMAP has already sold");
    expect(listingChangeReason(100000, { status: "cancelled", priceSats: 100000 })).toBe("This listing is no longer open");
  });
  it("blocks when no price was sent", () => {
    expect(listingChangeReason(undefined, { status: "open", priceSats: 1 })).not.toBeNull();
  });
});
