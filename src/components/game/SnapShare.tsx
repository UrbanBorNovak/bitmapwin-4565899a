import { useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Grab the live Oasis frame. Runs inside a frame callback so the WebGL buffer is still filled. */
function grabFrame(): Promise<Blob | null> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      // The world is the biggest canvas on the page (minimap/portraits are smaller).
      const canvas = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (!canvas) return resolve(null);
      try {
        const url = canvas.toDataURL("image/png");
        fetch(url).then((r) => r.blob()).then(resolve, () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  });
}

export function SnapShare({ height }: { height: number }) {
  const [busy, setBusy] = useState(false);
  const snap = async () => {
    setBusy(true);
    // Open the X window first so popup blockers allow it.
    const link = `https://bitmapwin.app/oasis?height=${height}`;
    const text = `Exploring ${height}.BITMAP in the Oasis — Bitcoin-native world\n\nDrop in: ${link}`;
    const win = window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    const blob = await grabFrame();
    setBusy(false);
    if (!blob) return toast.error("Couldn't capture the view — the link is still ready to post.");
    let copied = false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copied = true;
    } catch { /* clipboard image not supported */ }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${height}-bitmap-oasis.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast.success(copied ? "Snapshot copied & saved — paste it into your X post." : "Snapshot saved — attach it to your X post.");
    if (!win) toast.message("Allow pop-ups to open X automatically.");
  };
  return (
    <Button variant="terminalGhost" size="icon" type="button" aria-label="Snap & share on X" title="Snap & share on X" disabled={busy} onClick={() => void snap()} className="hud-panel hud-keep grid size-11 place-items-center text-signal hover:text-bitcoin">
      <Camera className="size-4" />
    </Button>
  );
}
