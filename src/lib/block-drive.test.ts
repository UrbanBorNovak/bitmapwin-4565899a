import { describe, it, expect } from "vitest";
import { driveContentType, driveKind, checkDriveFile, DRIVE_MAX_BYTES } from "./block-drive";
describe("block drive", () => {
  it("inscribes markdown journals as text/markdown", () => { expect(driveContentType("diary.md", "")).toBe("text/markdown;charset=utf-8"); });
  it("inscribes VRM avatars as glTF binary and labels them avatars", () => {
    expect(driveContentType("me.vrm", "")).toBe("model/gltf-binary");
    expect(driveKind("model/gltf-binary", "me.vrm")).toBe("avatar");
  });
  it("keeps the browser type for unknown extensions", () => { expect(driveContentType("x.bin", "application/pdf")).toBe("application/pdf"); });
  it("refuses files over 60,000 bytes", () => {
    expect(checkDriveFile(DRIVE_MAX_BYTES).ok).toBe(true);
    expect(checkDriveFile(DRIVE_MAX_BYTES + 1).ok).toBe(false);
  });
  it("refuses empty files", () => { expect(checkDriveFile(0).ok).toBe(false); });
});
