/**
 * The face of a BITMAP Pixel skin, cropped from its texture sheet.
 * Skins use the 8×8-tile layout: face front at tile (1,1), its overlay/mask at tile (5,1).
 */
const tile = (col: number, row: number) => `${(col / 7) * 100}% ${(row / 7) * 100}%`;

export function PixelFace({ inscriptionId, className = "", label }: { inscriptionId: string; className?: string; label: string }) {
  const url = `url(/api/public/inscription/${inscriptionId})`;
  const layer = { backgroundImage: url, backgroundSize: "800% 800%", imageRendering: "pixelated" as const };
  return (
    <div role="img" aria-label={label} className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0" style={{ ...layer, backgroundPosition: tile(1, 1) }} />
      <div className="absolute inset-0" style={{ ...layer, backgroundPosition: tile(5, 1) }} />
    </div>
  );
}
