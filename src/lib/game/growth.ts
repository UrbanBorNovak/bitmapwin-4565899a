import type { CardState, LivingCard } from "./types";

export const CARD_EVOLUTION_STATES: CardState[] = ["DORMANT", "ACTIVE", "AWAKENED", "DEVELOPED", "LEGENDARY"];

export function cardStateRank(state: CardState) {
  return CARD_EVOLUTION_STATES.indexOf(state);
}

export function nextLearningMilestone(card: LivingCard) {
  const typeAdaptationLearned = card.learning.adaptations.some((adaptation) =>
    ["FORTIFIED", "MASTERWORK", "DEEP_MEMORY", "PATHFINDER", "RESOLUTE", "CATALYST"].includes(adaptation),
  );
  if (!typeAdaptationLearned && card.plays < 3) {
    const remaining = 3 - card.plays;
    return `${remaining} MORE PLAY${remaining === 1 ? "" : "S"} FOR TYPE ADAPTATION`;
  }
  if (!card.learning.adaptations.includes("BATTLE_TESTED") && card.learning.actions < 8) {
    const remaining = 8 - card.learning.actions;
    return `${remaining} MORE ACTION${remaining === 1 ? "" : "S"} FOR BATTLE TESTED`;
  }
  if (!card.learning.adaptations.includes("VETERAN") && card.wins < 3) {
    const remaining = 3 - card.wins;
    return `${remaining} MORE WIN${remaining === 1 ? "" : "S"} FOR VETERAN`;
  }
  return "ALL CURRENT ADAPTATIONS LEARNED";
}

export function nextEvolutionMilestone(card: LivingCard) {
  if (card.state === "DORMANT") return "PLAY ONCE TO BECOME ACTIVE";
  if (card.state === "ACTIVE") {
    const actions = Math.max(0, 8 - card.learning.actions);
    const xp = Math.max(0, 12 - card.experience);
    return `${actions} ACTION${actions === 1 ? "" : "S"} OR ${xp} XP TO AWAKEN`;
  }
  if (card.state === "AWAKENED") {
    const xp = Math.max(0, 36 - card.experience);
    const builds = Math.max(0, 3 - (card.facts.buildCount ?? 0));
    return `${xp} XP OR ${builds} OASIS BUILD${builds === 1 ? "" : "S"} TO DEVELOP`;
  }
  if (card.state === "DEVELOPED") {
    const wins = Math.max(0, 5 - card.wins);
    const xp = Math.max(0, 60 - card.experience);
    if (wins === 0 && xp === 0) return "READY TO BECOME LEGENDARY";
    return `${wins} WIN${wins === 1 ? "" : "S"} + ${xp} XP TO BECOME LEGENDARY`;
  }
  return "LEGENDARY STATE REACHED";
}