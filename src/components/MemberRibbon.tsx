/** Shared, public-facing marker for an active on-chain or donation membership. */
export function MemberRibbon({ holder = false }: { holder?: boolean }) {
  return (
    <span className="member-ribbon" aria-label={holder ? "JIGGLYPUFF holder member" : "Active member"}>
      <span className="member-ribbon-mark" aria-hidden="true">✦</span>
      <span>MEMBER</span>
      {holder && <span className="member-ribbon-origin">JIGGLYPUFF HOLDER</span>}
    </span>
  );
}