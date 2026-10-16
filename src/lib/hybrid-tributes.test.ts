import { describe, expect, it } from "vitest";
import { hybridTributes } from "./hybrid-tributes";

describe("hybridTributes", () => {
  it("dual palindrome needs both block and sat palindromes", () => {
    expect(hybridTributes(12321, 1234321).map((t) => t.id)).toContain("dual-palindrome");
    expect(hybridTributes(12321, 1234567).map((t) => t.id)).not.toContain("dual-palindrome");
  });
  it("vintage on vintage needs sub-1k block and sub-1k mined sat", () => {
    expect(hybridTributes(500, 50 * 1e8 * 10).map((t) => t.id)).toContain("vintage-on-vintage");
    expect(hybridTributes(500, 50 * 1e8 * 2000).map((t) => t.id)).not.toContain("vintage-on-vintage");
  });
});
