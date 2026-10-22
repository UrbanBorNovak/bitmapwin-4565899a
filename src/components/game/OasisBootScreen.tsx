import { useEffect, useState } from "react";

const LINES = [
  "BITMAPWIN BIOS v1.09 · (C) 2009 GENESIS",
  "MEMORY TEST ........ 21,000,000 SATS OK",
  "DETECTING BLOCK INDEX ........ FOUND",
  "SOUND CARD ........ 8-BIT BEEPER",
  "LOADING DISTRICT TILES ........",
  "BOOTING THE OASIS_",
];

/** 90s BIOS-style boot screen shown while the 3D world loads. */
export function OasisBootScreen() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = window.setInterval(() => setN((v) => Math.min(LINES.length, v + 1)), 420);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="retro-crt retro-px flex h-[78vh] min-h-[520px] flex-col justify-center gap-2 border-2 border-border bg-background px-6 text-xs text-signal sm:px-16" data-no-translate>
      {LINES.slice(0, n).map((l, i) => (
        <p key={i} className={i === LINES.length - 1 ? "text-bitcoin" : ""}>{l}</p>
      ))}
      <div className="retro-bar mt-4 h-4 w-full max-w-md border-2 border-bitcoin p-0.5" role="progressbar" aria-label="Loading the Oasis">
        <i />
      </div>
    </div>
  );
}
