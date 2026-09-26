/** Shared, public-facing marker for a verified active membership. */
export function MemberRibbon() {
  return (
    <span className="member-ribbon" aria-label="Active member">
      <span className="member-ribbon-mark" aria-hidden="true">✦</span>
      <span>MEMBER</span>
    </span>
  );
}