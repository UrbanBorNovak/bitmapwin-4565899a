import { inscriptionImageUrl } from "@/lib/profiles";
import { shortId } from "@/lib/chain";

/**
 * Renders the real on-chain content of an inscription instead of its raw id.
 * Images/SVG render directly; every other content type (html, text bitmap
 * claims, 3d models, json) renders through the recursive preview frame.
 */
export function InscriptionContent({
  inscriptionId,
  contentType,
  className = "",
  title,
}: {
  inscriptionId: string;
  contentType?: string | null;
  className?: string;
  title?: string;
}) {
  const type = (contentType ?? "").toLowerCase();
  const isImage = type.startsWith("image/") && !type.includes("svg");

  return (
    <div className={`relative overflow-hidden bg-background ${className}`}>
      {isImage ? (
        <img
          src={inscriptionImageUrl(inscriptionId)}
          alt={title ?? `On-chain inscription ${shortId(inscriptionId)}`}
          loading="lazy"
          className="h-full w-full object-contain [image-rendering:pixelated]"
        />
      ) : (
        <iframe
          src={`https://ordinals.com/preview/${inscriptionId}`}
          title={title ?? `Inscription ${shortId(inscriptionId)}`}
          loading="lazy"
          sandbox="allow-scripts"
          scrolling="no"
          className="pointer-events-none h-full w-full border-0"
        />
      )}
    </div>
  );
}
