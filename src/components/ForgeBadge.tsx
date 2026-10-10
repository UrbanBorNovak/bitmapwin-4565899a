import { useQuery } from "@tanstack/react-query";
import { forgeBuildQuery, forgeBuiltQuery } from "@/lib/forge";

/** BUILT & INSCRIBED: shown only when the build is an on-chain child of this BITMAP. */
export function ForgeBadge({ height, live = false }: { height: number; live?: boolean }) {
  const liveQ = useQuery({ ...forgeBuildQuery(height), enabled: live });
  const dirQ = useQuery({ ...forgeBuiltQuery(height), enabled: !live });
  const id = live ? liveQ.data?.inscriptionId ?? null : dirQ.data ?? null;
  if (!id) return null;
  return (
    <a
      href={`https://ordinals.com/inscription/${id}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="This BITMAP's build is inscribed on Bitcoin as its child"
      className="inline-flex items-center rounded-sm border border-primary/60 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-primary"
    >
      BUILT & INSCRIBED
    </a>
  );
}
