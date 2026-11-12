export const ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];

export const RANK_TIERS = [
  "UNRANKED", "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM",
  "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER",
] as const;
export type RankTier = (typeof RANK_TIERS)[number];
export type RankDivision = "I" | "II" | "III" | "IV" | null;

export type RoleSkills = Record<Role, number>;

export type BalancePlayer = {
  id: string;
  name: string;
  nickname: string | null;
  tagline: string | null;
  rankTier: RankTier;
  rankDivision: RankDivision;
  rankLp: number | null;
  customSkill: number;
  roleSkills: RoleSkills;
  /** Organizer-set lane strength that replaces the computed one (admin-only data). */
  roleOverrides?: Partial<Record<Role, number>>;
};

export type SeparationRule = { playerAId: string; playerBId: string };
/** Players who should face each other in lane whenever two or more of them join a match. */
export type MatchupGroup = { name: string; playerIds: string[] };
export type Team = "BLUE" | "RED";

export type PlayerAssignment = {
  playerId: string;
  name: string;
  nickname: string | null;
  tagline: string | null;
  team: Team;
  role: Role;
  roleStrength: number;
  roleProficiency: number;
};

export type BalanceMetrics = {
  laneGaps: Record<Role, number>;
  maximumLaneGap: number;
  squaredLaneGapSum: number;
  blueTotalStrength: number;
  redTotalStrength: number;
  totalStrengthDifference: number;
  mainRoleAssignments: number;
  secondaryRoleAssignments: number;
  roleSatisfaction: number;
};

export type BalanceCandidate = {
  blue: PlayerAssignment[];
  red: PlayerAssignment[];
  metrics: BalanceMetrics;
  deterministicKey: string;
};

