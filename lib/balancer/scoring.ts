import type { BalancePlayer, RankDivision, RankTier, Role } from "@/lib/domain";

/**
 * Lane strength = player base × role factor.
 *
 * Role proficiency (0–5) only says how a player's own roles rank against each
 * other; how generous the rater was must not leak into cross-player scores.
 * So the factor comes from the role's *rank* within the player (ties share a
 * rank), not from the proficiency value itself:
 *
 * - base: normalized rank, shifted by custom skill (50 = neutral, ±customSkillSpread)
 * - rankFactor[k]: multiplier for the player's (k+1)-th best role
 * - weakRoleFactor: ceiling for proficiency 1 ("barely plays it", raw ≤ 20)
 */
export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  model: "tier-x-role-rank-v3" as const,
  customSkillSpread: 10,
  rankFactor: Object.freeze([1, 0.95, 0.9, 0.85, 0.8] as const),
  weakRoleFactor: 0.8,
});

export type ScoringWeights = {
  readonly model: "tier-x-role-rank-v3";
  readonly customSkillSpread: number;
  readonly rankFactor: readonly number[];
  readonly weakRoleFactor: number;
};

// Division IV value of each tier, and the step per division above it.
// The steps widen toward the top of the ladder, where each division is a
// bigger jump in skill. Master/GM/Challenger keep the organizer's fixed values.
const TIER_BASE: Record<RankTier, number> = {
  UNRANKED: 20,
  IRON: 20,
  BRONZE: 28,
  SILVER: 36,
  GOLD: 45,
  PLATINUM: 54,
  EMERALD: 63,
  DIAMOND: 75,
  MASTER: 90,
  GRANDMASTER: 100,
  CHALLENGER: 100,
};

const DIVISION_STEP: Record<RankTier, number> = {
  UNRANKED: 0, IRON: 2, BRONZE: 2, SILVER: 2, GOLD: 2.5, PLATINUM: 2.5,
  EMERALD: 3, DIAMOND: 3.5, MASTER: 0, GRANDMASTER: 0, CHALLENGER: 0,
};

const DIVISION_INDEX: Record<Exclude<RankDivision, null>, number> = { IV: 0, III: 1, II: 2, I: 3 };

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
  const divisionBonus = division ? DIVISION_INDEX[division] * DIVISION_STEP[tier] : 0;
  return clamp(TIER_BASE[tier] + divisionBonus, 0, 100);
}

export function playerBase(
  player: BalancePlayer,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  const custom = (clamp(player.customSkill, 0, 100) - 50) / 50;
  return normalizedRank(player.rankTier, player.rankDivision, player.rankLp) + custom * weights.customSkillSpread;
}

/** 1-based rank of a role among the player's playable roles; equal proficiency shares a rank. */
export function roleRank(player: BalancePlayer, role: Role): number {
  const proficiency = player.roleSkills[role];
  const higher = new Set(Object.values(player.roleSkills).filter((value) => value > proficiency));
  return higher.size + 1;
}

/** Multiplier applied to the player's base for this role; 0 when the role is forbidden. */
export function roleFactor(
  player: BalancePlayer,
  role: Role,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  const proficiency = player.roleSkills[role];
  if (proficiency === 0) return 0;
  const factors = weights.rankFactor;
  const byRank = factors[Math.min(roleRank(player, role), factors.length) - 1];
  return proficiency === 1 ? Math.min(byRank, weights.weakRoleFactor) : byRank;
}

export function roleStrength(
  player: BalancePlayer,
  role: Role,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  const factor = roleFactor(player, role, weights);
  if (factor === 0) return Number.NEGATIVE_INFINITY;
  return round(playerBase(player, weights) * factor, 2);
}

export function assertWeights(weights: ScoringWeights): void {
  const f = weights.rankFactor;
  const decreasing = f.length > 0 && f[0] <= 1 && f.every((v, i) => v > 0 && (i === 0 || v <= f[i - 1]));
  const weakOk = weights.weakRoleFactor > 0 && weights.weakRoleFactor <= 1;
  if (!decreasing || !weakOk || weights.customSkillSpread < 0) {
    throw new Error("라인 배율은 1순위부터 작아지는 0~1 사이 값이어야 합니다.");
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

