/** Live set of the local player's party members — read by combat to skip friendly fire. */
export const partyIds = new Set<string>();

export function setPartyIds(ids: string[]) {
  partyIds.clear();
  for (const id of ids) partyIds.add(id);
}
