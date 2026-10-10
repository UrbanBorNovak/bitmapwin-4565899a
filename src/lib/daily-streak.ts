/** Pure streak maths shared by the server claim and its tests. */
export const STREAK_BIT = [25, 40, 55, 70, 90, 115, 150] as const;

function prevDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** `days` = claimed UTC days (YYYY-MM-DD), any order. */
export function readStreak(days: (string | undefined)[], today: string) {
  const set = new Set(days.filter((d): d is string => !!d));
  const claimedToday = set.has(today);
  let cursor = claimedToday ? today : prevDay(today);
  let streak = 0;
  while (set.has(cursor)) { streak++; cursor = prevDay(cursor); }
  const nextStreak = claimedToday ? streak : streak + 1;
  const nextBit = STREAK_BIT[Math.min(nextStreak, STREAK_BIT.length) - 1] ?? STREAK_BIT[0];
  return { streak, claimedToday, nextStreak, nextBit };
}
