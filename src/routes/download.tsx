import { createFileRoute } from "@tanstack/react-router";

// Set once the GitHub repo is connected and the first desktop release is published.
const RELEASES_URL = "https://github.com/bitmapwin/bitmapwin/releases/latest";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
  head: () => ({
    meta: [
      { title: "Download BitmapWIN for Windows" },
      {
        name: "description",
        content: "BitmapWIN desktop app for Windows: the same Bitcoin-native worlds in their own window.",
      },
      { property: "og:title", content: "Download BitmapWIN for Windows" },
      {
        property: "og:description",
        content: "A light Windows installer that opens BitmapWIN in its own window.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DownloadPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs tracking-widest text-muted-foreground">DESKTOP · PREVIEW</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-foreground">BitmapWIN for Windows</h1>
      <p className="mt-4 text-muted-foreground">
        A small installer that opens bitmapwin.app in its own window, with a taskbar icon and no
        browser tabs. Everything you see is the live site, so it is always up to date.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <a
          href={RELEASES_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md bg-primary px-5 py-3 font-mono text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          DOWNLOAD FOR WINDOWS (.EXE)
        </a>
        <ul className="mt-5 space-y-1 font-mono text-xs text-muted-foreground">
          <li>Windows 10 or 11 · 64-bit</li>
          <li>Installs for your user only, no admin prompt</li>
          <li>Needs an internet connection</li>
        </ul>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Your keys and wallet stay in your wallet extension or app as they do in the browser; the
        desktop window adds no extra access to your computer.
      </p>
    </main>
  );
}
