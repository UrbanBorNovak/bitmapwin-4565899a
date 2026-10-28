import { useEffect, useState } from "react";
import { probeRgb, RGB_LABEL, type RgbStatus } from "@/lib/rgb-wallet";

/** Shows whether the visitor's own wallet exposes RGB (USDT on Bitcoin) support. */
export function RgbBadge({ className = "" }: { className?: string }) {
  const [s, setS] = useState<RgbStatus | null>(null);
  useEffect(() => {
    let n = 0;
    setS(probeRgb());
    const id = window.setInterval(() => { setS(probeRgb()); if (++n >= 5) window.clearInterval(id); }, 600);
    return () => window.clearInterval(id);
  }, []);
  if (!s) return null;
  const ready = s === "ready";
  return (
    <span
      title={ready ? "Your wallet exposes RGB support (client-side validated assets on Bitcoin)." : "RGB support appears here once your wallet ships it. Sats checkout keeps working."}
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] ${ready ? "border-signal text-signal" : "border-border text-muted-foreground"} ${className}`}
    >
      ◇ {RGB_LABEL[s]}
    </span>
  );
}
