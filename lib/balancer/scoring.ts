import type { BalancePlayer, RankDivision, RankTier, Role } from "@/lib/domain";

export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  rank: 0.4,
  customSkill: 0.25,
  roleProficiency: 0.35,
});

export type ScoringWeights = typeof DEFAULT_SCORING_WEIGHTS;

const TIER_BASE: Record<RankTier, number> = {
  UNRANKED: 20,
  IRON: 25,
  BRONZE: 35,
  SILVER: 45,
  GOLD: 55,
  PLATINUM: 65,
  EMERALD: 72,
  DIAMOND: 80,
  MASTER: 90,
  GRANDMASTER: 95,
  CHALLENGER: 100,
};

const DIVISION_BONUS: Record<Exclude<RankDivision, null>, number> = {
  IV: 0,
  III: 2.5,
  II: 5,
  I: 7.5,
};

/**
 * Deterministic 0–100 mapping. Standard tiers keep a small within-division
 * adjustment. Master uses explicit 200-LP brackets requested by the organizer.
 * These values are configurable heuristics, not win probabilities.
 */
export function normalizedRank(
  tier: RankTier,
  division: RankDivision,
  lp: number | null,
): number {
  if (tier === "UNRANKED") return TIER_BASE.UNRANKED;
  const safeLp = Math.max(0, lp ?? 0);
  if (tier === "MASTER") return clamp(TIER_BASE.MASTER + Math.floor(safeLp / 200) * 5, 0, 100);
  if (["GRANDMASTER", "CHALLENGER"].includes(tier)) return TIER_BASE[tier];
  const divisionBonus = division ? DIVISION_BONUS[division] : 0;
  return clamp(TIER_BASE[tier] + divisionBonus + Math.min(safeLp / 100 * 1.5, 1.5), 0, 100);
}

export function roleStrength(
  player: BalancePlayer,
  role: Role,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  const proficiency = player.roleSkills[role];
  if (proficiency === 0) return Number.NEGATIVE_INFINITY;
  const value =
    weights.rank * normalizedRank(player.rankTier, player.rankDivision, player.rankLp) +
    weights.customSkill * clamp(player.customSkill, 0, 100) +
    weights.roleProficiency * (proficiency * 20);
  return round(value, 2);
}

export function assertWeights(weights: ScoringWeights): void {
  const sum = weights.rank + weights.customSkill + weights.roleProficiency;
  if (Math.abs(sum - 1) > 0.00001 || Object.values(weights).some((value) => value < 0)) {
    throw new Error("점수 가중치는 0 이상이며 합계가 1이어야 합니다.");
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

