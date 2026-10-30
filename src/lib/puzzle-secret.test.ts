import { describe, expect, it } from "vitest";
import { confirmMatches, redactSecrets, safeError } from "./puzzle-secret";

const KEY = "000000000000000000000000000000000000000000000049fa8d3f1a2b3c4d5e";

describe("puzzle secrets", () => {
  it("redacts a 64-hex private key from messages", () => {
    expect(redactSecrets(`bad ${KEY} end`)).toBe("bad [REDACTED] end");
  });
  it("redacts a signed transaction hex from error text", () => {
    expect(safeError(new Error(`rejected 0200000001${"ab".repeat(100)}`))).toBe("rejected [REDACTED]");
  });
  it("redacts a WIF key", () => {
    expect(redactSecrets("KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn")).toBe("[REDACTED]");
  });
  it("keeps short txids-free text intact", () => {
    expect(redactSecrets("fee too low")).toBe("fee too low");
  });
  it("submission requires the exact confirmation phrase", () => {
    expect(confirmMatches("submit to mara")).toBe(true);
    expect(confirmMatches("submit")).toBe(false);
    expect(confirmMatches("")).toBe(false);
  });
});
