/**
 * GUARDIAN RAID COMBAT — pure and deterministic. Stats come from each
 * Guardian's own Bitcoin block (guardianFromBlock), the seed from the
 * dispatch, so anyone can replay a raid and get the same result.
 */
export type Fighter = { height: number; hp: number; bite: number; armor: number; speed: number };
export type RaidRound = { round: number; by: number; damage: number; attackerHp: number; defenderHp: number };
export type RaidResult = { winner: number; loser: number; spoils: number; rounds: RaidRound[] };

const MAX_ROUNDS = 12;
/** Defender fights on home ground. */
const HOME_ARMOR = 1.15;
/** Extra armour when the defender's brain is guarding at the moment of arrival. */
export const GUARD_ARMOR = 1.3;

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

export function resolveRaid(attacker: Fighter, defender: Fighter, seed: string, opts: { guarding?: boolean } = {}): RaidResult {
  const roll = rng(seed);
  let aHp = attacker.hp, dHp = defender.hp;
  const dArmor = defender.armor * HOME_ARMOR * (opts.guarding ? GUARD_ARMOR : 1);
  // Speed decides who strikes first; ties go to the defender.
  let turn: "a" | "d" = attacker.speed > defender.speed ? "a" : "d";
  const rounds: RaidRound[] = [];
  for (let r = 1; r <= MAX_ROUNDS * 2 && aHp > 0 && dHp > 0; r++) {
    const atk = turn === "a" ? attacker : defender;
    const armor = turn === "a" ? dArmor : attacker.armor;
    const other = turn === "a" ? defender : attacker;
    // Faster target dodges more often.
    const dodge = Math.min(0.35, Math.max(0, (other.speed - atk.speed) / 200));
    const hit = roll() >= dodge;
    const damage = hit ? Math.max(1, Math.round(atk.bite * (0.85 + roll() * 0.3) * 2 - armor)) : 0;
    if (turn === "a") dHp = Math.max(0, dHp - damage); else aHp = Math.max(0, aHp - damage);
    rounds.push({ round: Math.ceil(r / 2), by: atk.height, damage, attackerHp: aHp, defenderHp: dHp });
    turn = turn === "a" ? "d" : "a";
  }
  const aLeft = aHp / attacker.hp, dLeft = dHp / defender.hp;
  const attackerWins = aLeft > dLeft;
  const margin = Math.abs(aLeft - dLeft);
  return {
    winner: attackerWins ? attacker.height : defender.height,
    loser: attackerWins ? defender.height : attacker.height,
    spoils: 10 + Math.round(margin * 90),
    rounds,
  };
}

/** Moment a march reaches its target: end of the first leg. */
export function arrivalMs(startMs: number, endMs: number, holdSeconds: number) {
  // Route is home → target (leg) → hold → home (same leg length).
  return startMs + (endMs - startMs - holdSeconds * 1000) / 2;
}
