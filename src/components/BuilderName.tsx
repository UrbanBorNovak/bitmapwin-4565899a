import { inscriptionImageUrl, type WalletProfile } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";

/**
 * Shows a builder by their profile name (the same name they set in their wallet
 * profile), falling back to the shortened address when no profile exists.
 */
export function builderLabel(address: string, profile?: WalletProfile | null): string {
  const name = profile?.displayName?.trim();
  return name && name !== "" ? name.toUpperCase() : shortenAddress(address);
}

export function BuilderName({
  address,
  profile,
  avatar = false,
  className = "",
}: {
  address: string;
  profile?: WalletProfile | null;
  avatar?: boolean;
  className?: string;
}) {
  const label = builderLabel(address, profile);
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {avatar && profile?.avatarInscriptionId ? (
        <img
          src={inscriptionImageUrl(profile.avatarInscriptionId)}
          alt={`${label} avatar`}
          loading="lazy"
          className="h-5 w-5 shrink-0 border border-border object-cover"
        />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
