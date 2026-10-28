import { describe, expect, it } from "vitest";
import { cleanHandle, profileMessage, STATUS_MAX } from "@/lib/launch-seats";

describe("seat profile", () => {
  it("accepts X handles up to 15 letters, numbers or _", () => {
    expect(cleanHandle("@dev_9")).toBe("dev_9");
    expect(cleanHandle("a".repeat(16))).toBeNull();
    expect(cleanHandle("bad handle")).toBeNull();
  });
  it("caps status at 40 characters", () => {
    expect(STATUS_MAX).toBe(40);
  });
  it("signs the exact handle and status", () => {
    expect(profileMessage("bc1p", "t", "dev9", "hi")).toContain("X: dev9\nSTATUS: hi");
  });
});
