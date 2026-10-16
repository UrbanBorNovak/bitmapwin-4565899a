/** Block-number facts any viewer can re-derive from the height alone. */
export type HeightTag = "999 CLUB" | "SUB 10K" | "SUB 100K" | "PALINDROME";

export function heightTags(h: number): HeightTag[] {
  const tags: HeightTag[] = [];
  if (h < 1000) tags.push("999 CLUB");
  else if (h < 10_000) tags.push("SUB 10K");
  else if (h < 100_000) tags.push("SUB 100K");
  const s = String(h);
  if (s.length >= 3 && s === [...s].reverse().join("")) tags.push("PALINDROME");
  return tags;
}

export type RosterFilter = "all" | "guardian" | "built" | "deployed" | "rare" | "empty";

export type RosterRow = { height: number; built: boolean; guardian: boolean; deployments: number };

export function filterRoster(rows: RosterRow[], f: RosterFilter): RosterRow[] {
  switch (f) {
    case "guardian": return rows.filter((r) => r.guardian);
    case "built": return rows.filter((r) => r.built);
    case "deployed": return rows.filter((r) => r.deployments > 0);
    case "rare": return rows.filter((r) => heightTags(r.height).length > 0);
    case "empty": return rows.filter((r) => !r.built && !r.guardian && r.deployments === 0);
    default: return rows;
  }
}
