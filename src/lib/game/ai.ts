import { attack, canPlay, legalTargets, type MatchState } from "./engine";

export type AiAction = { kind: "play"; uid: string } | { kind: "attack"; uid: string; target: string | "hero" } | { kind: "end" };

/** Deterministic local rival: returns the single next action for the current state. */
export function nextAiAction(s: MatchState): AiAction {
  if (s.winner || s.active !== "ai") return { kind: "end" };
  const me = s.sides.ai;
  const foe = s.sides.player;

  // 1. Play: lethal events first, then the best-value affordable card.
  const playable = me.hand.filter((c) => canPlay(s, "ai", c.uid));
  if (playable.length) {
    const lethal = playable.find((c) => c.type === "EVENT" && foe.board.length === 0 && c.atk >= foe.hp);
    if (lethal) return { kind: "play", uid: lethal.uid };
    const threatened = foe.board.reduce((n, u) => n + u.atk, 0) >= me.hp / 2;
    const score = (c: (typeof playable)[number]) =>
      c.atk + c.hp + (c.type === "GUARDIAN" && threatened ? 6 : 0) + (c.type === "TERRITORY" && s.turn < 4 ? 3 : 0) +
      (c.type === "EVENT" && foe.board.some((u) => u.hp <= c.atk) ? 5 : 0) + (c.type === "MINER" && me.hand.length < 3 ? 3 : 0);
    const best = [...playable].sort((a, b) => score(b) - score(a))[0]!;
    return { kind: "play", uid: best.uid };
  }

  // 2. Attack: go for lethal, otherwise take good trades, otherwise face.
  const ready = me.board.filter((u) => u.ready);
  if (ready.length) {
    const a = [...ready].sort((x, y) => y.atk - x.atk)[0]!;
    const legal = legalTargets(s, "ai");
    const totalAtk = ready.reduce((n, u) => n + u.atk, 0);
    if (legal.hero && totalAtk >= foe.hp) return { kind: "attack", uid: a.uid, target: "hero" };
    const targets = foe.board.filter((u) => legal.units.includes(u.uid));
    const goodTrade = targets
      .filter((t) => t.hp <= a.atk && (t.atk < a.hp || t.atk >= 3))
      .sort((x, y) => y.atk - x.atk)[0];
    if (goodTrade) return { kind: "attack", uid: a.uid, target: goodTrade.uid };
    if (legal.hero) return { kind: "attack", uid: a.uid, target: "hero" };
    if (targets[0]) return { kind: "attack", uid: a.uid, target: targets[0].uid };
  }
  return { kind: "end" };
}

export function isNoop(s: MatchState, action: AiAction) {
  if (action.kind !== "attack") return false;
  return attack(s, "ai", action.uid, action.target) === s;
}
