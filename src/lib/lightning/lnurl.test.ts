import { describe, expect, it } from "vitest";
import { lnAddressUrl, tipMsat } from "./lnurl";

describe("lightning tips", () => {
  it("turns a Lightning Address into its LNURL-pay URL", () => {
    expect(lnAddressUrl("Dev9@GetAlby.com")).toBe("https://getalby.com/.well-known/lnurlp/dev9");
    expect(lnAddressUrl("not-an-address")).toBeNull();
  });
  it("refuses tips outside the receiver's limits", () => {
    expect(tipMsat(21, { minSendable: 1000, maxSendable: 1e9 })).toBe(21000);
    expect(tipMsat(21, { minSendable: 100_000, maxSendable: 1e9 })).toBeNull();
    expect(tipMsat(0, { minSendable: 1000, maxSendable: 1e9 })).toBeNull();
  });
});
