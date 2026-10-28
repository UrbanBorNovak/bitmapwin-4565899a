/**
 * The face of a BITMAP Pixel skin, cropped from its texture sheet.
 * Skins use the 8×8-tile layout: face front at tile (1,1), its overlay/mask at tile (5,1).
 * Text/BRC-420 inscriptions are followed to the PNG texture they declare.
 */
import { useEffect, useState } from "react";
import { resolvePixelTexture } from "@/lib/pixel-texture";

const tile = (col: number, row: number) => `${(col / 7) * 100}% ${(row / 7) * 100}%`;

export function PixelFace({ inscriptionId, className = "", label }: { inscriptionId: string; className?: string; label: string }) {
  const [tex, setTex] = useState<string | null>(null);
  useEffect(() => {
    let live = true; setTex(null);
    resolvePixelTexture(inscriptionId).then((t) => { if (live) setTex(t); });
    return () => { live = false; };
  }, [inscriptionId]);
  const layer = tex ? { backgroundImage: `url(/api/public/inscription/${tex})`, backgroundSize: "800% 800%", imageRendering: "pixelated" as const } : {};
  return (
    <div role="img" aria-label={label} className={`relative overflow-hidden bg-muted ${className}`}>
      {tex && <div className="absolute inset-0" style={{ ...layer, backgroundPosition: tile(1, 1) }} />}
      {tex && <div className="absolute inset-0" style={{ ...layer, backgroundPosition: tile(5, 1) }} />}
    </div>
  );
}
