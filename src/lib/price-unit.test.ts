import { describe, expect, it } from "vitest";
import { formatInUnit } from "./price-unit";

describe("formatInUnit", () => {
  it("shows whole sats", () => expect(formatInUnit(1_250_000, "sats", null)).toBe("1,250,000 SATS"));
  it("shows BTC", () => expect(formatInUnit(1_250_000, "btc", null)).toBe("0.0125 BTC"));
  it("converts to USD at the live rate", () => expect(formatInUnit(1_000_000, "usd", 100_000)).toBe("$1,000"));
  it("falls back to BTC without a rate", () => expect(formatInUnit(1_000_000, "usd", null)).toBe("0.0100 BTC"));
});
