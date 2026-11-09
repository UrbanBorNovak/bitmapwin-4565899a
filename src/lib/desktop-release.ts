// Windows desktop installer lookup. The installer is built by
// .github/workflows/desktop-release.yml on desktop-v* tags and saved as a draft
// GitHub release; it only counts as available once that release is published
// and carries a Windows .exe asset.

export const DESKTOP_REPO = "UrbanBorNovak/BitmapWin";
export const DESKTOP_RELEASES_URL = `https://github.com/${DESKTOP_REPO}/releases/latest`;
// GitHub's "latest" endpoint skips drafts and pre-releases.
export const DESKTOP_LATEST_API = `https://api.github.com/repos/${DESKTOP_REPO}/releases/latest`;

export type DesktopInstaller = {
  version: string;
  fileName: string;
  url: string;
  sizeBytes: number;
  releaseUrl: string;
};

type GhAsset = { name?: unknown; browser_download_url?: unknown; size?: unknown; state?: unknown };
type GhRelease = { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown };

/** Pick the Windows installer from a GitHub release, or null when there is none. */
export function pickWindowsInstaller(release: unknown): DesktopInstaller | null {
  if (!release || typeof release !== "object") return null;
  const r = release as GhRelease;
  if (r.draft === true || r.prerelease === true) return null;
  if (!Array.isArray(r.assets)) return null;
  const exes = (r.assets as GhAsset[]).filter(
    (a) =>
      typeof a?.name === "string" &&
      a.name.toLowerCase().endsWith(".exe") &&
      typeof a.browser_download_url === "string" &&
      a.browser_download_url.startsWith("https://github.com/") &&
      (a.state === undefined || a.state === "uploaded"),
  );
  if (exes.length === 0) return null;
  // Prefer the NSIS setup installer when the release carries more than one .exe.
  const asset = exes.find((a) => /setup/i.test(String(a.name))) ?? exes[0];
  return {
    version: typeof r.tag_name === "string" ? r.tag_name : "",
    fileName: String(asset.name),
    url: String(asset.browser_download_url),
    sizeBytes: typeof asset.size === "number" ? asset.size : 0,
    releaseUrl: typeof r.html_url === "string" ? r.html_url : DESKTOP_RELEASES_URL,
  };
}

/** Fetch the latest published release; resolves null when no installer is out yet. */
export async function fetchWindowsInstaller(): Promise<DesktopInstaller | null> {
  const res = await fetch(DESKTOP_LATEST_API, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) return null; // no published release yet
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return pickWindowsInstaller(await res.json());
}
