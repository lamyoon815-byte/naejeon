import type { BalancePlayer, RankDivision, RankTier, RoleSkills } from "./domain";

export type PlayerRow = {
  id: string; name: string; nickname: string | null; tagline: string | null; rank_tier: string; rank_division: string | null;
  rank_lp: number | null; custom_skill: number | string; is_active: boolean;
  created_at: string; updated_at: string;
  player_role_skills: { top: number; jungle: number; mid: number; adc: number; support: number } | Array<{ top: number; jungle: number; mid: number; adc: number; support: number }>;
};

export function toBalancePlayer(row: PlayerRow): BalancePlayer {
  const skills = Array.isArray(row.player_role_skills) ? row.player_role_skills[0] : row.player_role_skills;
  if (!skills) throw new Error(`플레이어 ${row.id}의 포지션 정보가 없습니다.`);
  return {
    id: row.id, name: row.name, nickname: row.nickname, tagline: row.tagline, rankTier: row.rank_tier as RankTier,
    rankDivision: row.rank_division as RankDivision, rankLp: row.rank_lp,
    customSkill: Number(row.custom_skill),
    roleSkills: { TOP: skills.top, JUNGLE: skills.jungle, MID: skills.mid, ADC: skills.adc, SUPPORT: skills.support } satisfies RoleSkills,
  };
}

export function toPlayerResponse(row: PlayerRow) {
  return { ...toBalancePlayer(row), isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function toPlayerColumns(input: { name?: string; nickname?: string | null; tagline?: string | null; rankTier?: string; rankDivision?: string | null; rankLp?: number | null; customSkill?: number }) {
  return Object.fromEntries(Object.entries({ name: input.name, nickname: input.nickname, tagline: input.tagline, rank_tier: input.rankTier, rank_division: input.rankDivision, rank_lp: input.rankLp, custom_skill: input.customSkill }).filter(([, value]) => value !== undefined));
}

export function toRoleSkillColumns(skills: RoleSkills) {
  return { top: skills.TOP, jungle: skills.JUNGLE, mid: skills.MID, adc: skills.ADC, support: skills.SUPPORT };
}

