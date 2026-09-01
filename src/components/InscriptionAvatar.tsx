import { useEffect, useState } from "react";
import { inscriptionImageUrl } from "@/lib/profiles";

/**
 * Renders an inscription as an avatar image. Non-image inscriptions (text
 * bitmap claims, JSON, html) fail to decode, so we fall back to a monogram.
 */
export function InscriptionAvatar({
  inscriptionId,
  label,
  className = "",
  fallbackClassName = "",
  alt = "",
}: {
  inscriptionId: string | null | undefined;
  label?: string;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [inscriptionId]);

  if (!inscriptionId || broken) {
    return (
      <span
        className={`flex items-center justify-center font-mono text-muted-foreground ${className} ${fallbackClassName}`}
      >
        {(label?.trim()?.[0] ?? "?").toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={inscriptionImageUrl(inscriptionId)}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`object-cover ${className}`}
    />
  );
}
