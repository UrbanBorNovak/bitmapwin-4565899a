export function TraitHolderBadge({ traits = [] }: { traits?: string[] }) {
  const detail = traits.length ? `Verified holder · ${traits.join(", ")}` : "Verified official trait holder";
  return (
    <span className="inline-flex items-center gap-1 border border-signal px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-signal" title={detail}>
      <span aria-hidden>◆</span> TRAIT HOLDER
    </span>
  );
}