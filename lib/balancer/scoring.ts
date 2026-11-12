import type { BalancePlayer, RankDivision, RankTier, Role } from "@/lib/domain";

/**
 * Lane strength = tier score, minus one tier on lanes outside a player's main
 * and secondary positions.
 *
 * Role proficiency (0–5) only classifies the player's own lanes:
 * - 5 = main (주포), 4 = secondary (부포). An all-liner has every lane at 4–5.
 * - 1–3 = other lanes: played one tier lower (−offRolePenalty).
 * - 0 = forbidden.
 * Custom skill shifts the whole player by up to ±customSkillSpread (50 = neutral).
 */
export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  model: "tier-step-v4" as const,
  customSkillSpread: 5,
  offRolePenalty: 15,
});

export type ScoringWeights = {
  readonly model: "tier-step-v4";
  readonly customSkillSpread: number;
  readonly offRolePenalty: number;
};

/** Points per tier; divisions split it evenly (IV → I = 3 steps). */
export const TIER_STEP = 15;

// Division IV value of each tier. Master/GM/Challenger keep the organizer's fixed values.
const TIER_BASE: Record<RankTier, number> = {
  UNRANKED: 20,
  IRON: 0,
  BRONZE: 0,
  SILVER: 15,
  GOLD: 30,
  PLATINUM: 45,
  EMERALD: 60,
  DIAMOND: 75,
  MASTER: 90,
  GRANDMASTER: 100,
  CHALLENGER: 100,
};

const DIVISION_INDEX: Record<Exclude<RankDivision, null>, number> = { IV: 0, III: 1, II: 2, I: 3 };

/**
 * Deterministic 0–100 mapping: 15 points per tier, 3.75 per division.
 * Master uses explicit 200-LP brackets requested by the organizer.
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
  const divisionBonus = division ? DIVISION_INDEX[division] * (TIER_STEP / 4) : 0;
  return clamp(TIER_BASE[tier] + divisionBonus, 0, 100);
}

export function playerBase(
  player: BalancePlayer,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  const custom = (clamp(player.customSkill, 0, 100) - 50) / 50;
  return normalizedRank(player.rankTier, player.rankDivision, player.rankLp) + custom * weights.customSkillSpread;
}

/** True for main (5) and secondary (4) lanes, which play at full tier. */
export function isMainOrSecondary(player: BalancePlayer, role: Role): boolean {
  return player.roleSkills[role] >= 4;
}

/** 1-based rank of a role among the player's playable roles; equal proficiency shares a rank. */
export function roleRank(player: BalancePlayer, role: Role): number {
  const proficiency = player.roleSkills[role];
  const higher = new Set(Object.values(player.roleSkills).filter((value) => value > proficiency));
  return higher.size + 1;
}

/** How happy the player is on this lane (used only to break near-ties): main 1, secondary 0.95, other 0.8, forbidden 0. */
export function roleFactor(player: BalancePlayer, role: Role): number {
  const proficiency = player.roleSkills[role];
  if (proficiency === 0) return 0;
  return proficiency >= 5 ? 1 : proficiency === 4 ? 0.95 : 0.8;
}

export function roleStrength(
  player: BalancePlayer,
  role: Role,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  if (player.roleSkills[role] === 0) return Number.NEGATIVE_INFINITY;
  const override = player.roleOverrides?.[role];
  if (override !== undefined) return round(override, 2);
  const penalty = isMainOrSecondary(player, role) ? 0 : weights.offRolePenalty;
  return round(playerBase(player, weights) - penalty, 2);
}

export function assertWeights(weights: ScoringWeights): void {
  if (weights.customSkillSpread < 0 || weights.offRolePenalty < 0) {
    throw new Error("커스텀 보정 폭과 부라인 감점은 0 이상이어야 합니다.");
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

