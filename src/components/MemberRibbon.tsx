/** Shared, public-facing marker for a verified active membership. */
export function MemberRibbon({ label = "MEMBER" }: { label?: string }) {
  return (
    <span className="member-ribbon" aria-label="Active member">
      <span className="member-ribbon-mark" aria-hidden="true">✦</span>
      <span>{label}</span>
    </span>
  );
}