import { describe, expect, it } from "vitest";
import { pickWindowsInstaller } from "./desktop-release";

const exe = {
  name: "BitmapWIN_0.1.0_x64-setup.exe",
  browser_download_url:
    "https://github.com/UrbanBorNovak/BitmapWin/releases/download/desktop-v0.1.0/BitmapWIN_0.1.0_x64-setup.exe",
  size: 4_200_000,
  state: "uploaded",
};

describe("pickWindowsInstaller", () => {
  it("returns the .exe from a published release", () => {
    const got = pickWindowsInstaller({ tag_name: "desktop-v0.1.0", draft: false, prerelease: false, assets: [exe] });
    expect(got?.url).toBe(exe.browser_download_url);
    expect(got?.version).toBe("desktop-v0.1.0");
  });

  it("keeps the button disabled for a release without an .exe", () => {
    expect(
      pickWindowsInstaller({ draft: false, assets: [{ ...exe, name: "BitmapWIN_0.1.0_x64.msi" }] }),
    ).toBeNull();
  });

  it("keeps the button disabled for draft releases", () => {
    expect(pickWindowsInstaller({ draft: true, assets: [exe] })).toBeNull();
  });

  it("ignores an .exe that has not finished uploading", () => {
    expect(pickWindowsInstaller({ draft: false, assets: [{ ...exe, state: "new" }] })).toBeNull();
  });
});
