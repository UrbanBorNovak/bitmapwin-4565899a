import { useQuery } from "@tanstack/react-query";
import { forgeBuildQuery, forgeBuiltQuery } from "@/lib/forge";

/** REINSCRIBED BUILD: shown only when the build sits on this BITMAP's own sat (or, for older builds, is its child). */
export function ForgeBadge({ height, live = false }: { height: number; live?: boolean }) {
  const liveQ = useQuery({ ...forgeBuildQuery(height), enabled: live });
  const dirQ = useQuery({ ...forgeBuiltQuery(height), enabled: !live });
  const b = live ? liveQ.data ?? null : dirQ.data ?? null;
  if (!b?.inscriptionId) return null;
  const href = b.sat ? `https://ordinals.com/sat/${b.sat}` : `https://ordinals.com/inscription/${b.inscriptionId}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={b.sat ? "This BITMAP's build is reinscribed on its own sat" : "This BITMAP's build is inscribed as its child"}
      className="inline-flex items-center rounded-sm border border-primary/60 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-primary"
    >
      {b.sat ? `REINSCRIBED BUILD · SAT #${b.sat}` : "BUILT & INSCRIBED"}
    </a>
  );
}
