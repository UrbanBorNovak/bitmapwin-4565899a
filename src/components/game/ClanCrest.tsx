import { clanImageUrl, type ClanBadge } from "@/lib/clans";
import { clanCrestImage } from "@/lib/ranks";

export function ClanCrest({ clan, className = "size-5" }: { clan: ClanBadge; className?: string }) {
  return (
    <img
      src={clanCrestImage(clan.tag) ?? clanImageUrl(clan.crestInscriptionId)}
      alt={`${clan.tag} clan crest`}
      className={`${className} shrink-0 border border-bitcoin bg-background object-contain [image-rendering:pixelated]`}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
