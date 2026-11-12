import {
  ROLES,
  type BalanceCandidate,
  type BalanceMetrics,
  type BalancePlayer,
  type MatchupGroup,
  type PlayerAssignment,
  type Role,
  type SeparationRule,
  type Team,
} from "@/lib/domain";
import { assertWeights, DEFAULT_SCORING_WEIGHTS, roleFactor, roleRank, roleStrength, type ScoringWeights } from "./scoring";

export class NoValidAssignmentError extends Error {
  readonly code = "NO_VALID_ASSIGNMENT";
  constructor() {
    super("현재 포지션 가능 여부와 팀 분리 조건으로는 유효한 팀을 만들 수 없습니다. 참가자 또는 설정을 확인해 주세요.");
  }
}

type EngineOptions = { limit?: number; weights?: ScoringWeights; laneGapTolerance?: number; matchupGroups?: MatchupGroup[] };

/**
 * Lane-gap points within which two lineups count as equally fair. Among those,
 * the one that puts more players on their stronger roles wins.
 */
export const DEFAULT_LANE_GAP_TOLERANCE = 4;
type Pair = { blueIndex: number; redIndex: number; role: Role; gap: number };

export function generateBalancedTeams(
  players: BalancePlayer[],
  separationRules: SeparationRule[] = [],
  options: EngineOptions = {},
): BalanceCandidate[] {
  if (players.length !== 10) throw new Error("팀 생성에는 정확히 10명의 참가자가 필요합니다.");
  if (new Set(players.map((player) => player.id)).size !== 10) throw new Error("중복된 참가자가 포함되어 있습니다.");
  const weights = options.weights ?? DEFAULT_SCORING_WEIGHTS;
  assertWeights(weights);
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
  const strengths = players.map((player) => Object.fromEntries(
    ROLES.map((role) => [role, roleStrength(player, role, weights)]),
  ) as Record<Role, number>);
  const forbidden = buildForbiddenMap(separationRules);
  const eligibleByRole = Object.fromEntries(ROLES.map((role) => [role,
    players.map((player, index) => ({ player, index })).filter(({ player }) => player.roleSkills[role] > 0).map(({ index }) => index),
  ])) as Record<Role, number[]>;

  for (const role of ROLES) {
    if (eligibleByRole[role].length < 2) throw new NoValidAssignmentError();
  }

  // Matchup groups: members should face each other. With k members present,
  // floor(k/2) in-group lanes are required, so at most k mod 2 members (plus any
  // relaxation below) may face someone outside the group.
  const groupOf = new Map<number, number>();
  const groupSizes: number[] = [];
  for (const group of options.matchupGroups ?? []) {
    const members = players.map((p, index) => ({ p, index })).filter(({ p, index }) => group.playerIds.includes(p.id) && !groupOf.has(index));
    if (members.length < 2) continue;
    for (const { index } of members) groupOf.set(index, groupSizes.length);
    groupSizes.push(members.length);
  }
  let outsideBudget: number[] = [];

  function spendOutsideBudget(blueIndex: number, redIndex: number, delta: number, undo?: number[]): number[] {
    if (undo) { for (const g of undo) outsideBudget[g] += delta; return undo; }
    const gb = groupOf.get(blueIndex), gr = groupOf.get(redIndex);
    if (gb !== undefined && gb === gr) return [];
    const touched = [gb, gr].filter((g): g is number => g !== undefined);
    for (const g of touched) outsideBudget[g] += delta;
    return touched;
  }

  const used = new Set<number>();
  const blueIds = new Set<string>();
  const redIds = new Set<string>();
  const chosen: Pair[] = [];

  // Walks every valid lineup whose largest lane gap stays within bound().
  function visit(roleIndex: number, currentMaxGap: number, bound: () => number, onLeaf: () => void) {
    if (currentMaxGap > bound()) return;
    if (outsideBudget.some((left) => left < 0)) return;
    if (roleIndex === ROLES.length) { onLeaf(); return; }
    const role = ROLES[roleIndex];
    const eligible = eligibleByRole[role];
    for (const blueIndex of eligible) {
      if (used.has(blueIndex)) continue;
      const bluePlayer = players[blueIndex];
      if (hasTeamConflict(bluePlayer.id, blueIds, forbidden)) continue;
      for (const redIndex of eligible) {
        if (redIndex === blueIndex || used.has(redIndex)) continue;
        const redPlayer = players[redIndex];
        if (hasTeamConflict(redPlayer.id, redIds, forbidden)) continue;
        // Blue/Red label symmetry: only explore the canonical TOP orientation.
        if (roleIndex === 0 && bluePlayer.id.localeCompare(redPlayer.id) > 0) continue;
        const gap = round(Math.abs(strengths[blueIndex][role] - strengths[redIndex][role]), 2);
        used.add(blueIndex); used.add(redIndex);
        blueIds.add(bluePlayer.id); redIds.add(redPlayer.id);
        const spent = spendOutsideBudget(blueIndex, redIndex, -1);
        chosen.push({ blueIndex, redIndex, role, gap });
        visit(roleIndex + 1, Math.max(currentMaxGap, gap), bound, onLeaf);
        chosen.pop(); spendOutsideBudget(blueIndex, redIndex, 1, spent); blueIds.delete(bluePlayer.id); redIds.delete(redPlayer.id);
        used.delete(blueIndex); used.delete(redIndex);
      }
    }
  }

  function search(relax: number): BalanceCandidate[] {
    const fresh = () => groupSizes.map((size) => Math.min(size, size % 2 + 2 * relax));
    // Pass 1: the smallest achievable largest lane gap.
    let bestMaxGap = Number.POSITIVE_INFINITY;
    outsideBudget = fresh();
    visit(0, 0, () => bestMaxGap, () => {
      bestMaxGap = Math.min(bestMaxGap, Math.max(...chosen.map((pair) => pair.gap)));
    });
    if (!Number.isFinite(bestMaxGap)) return [];

    // Pass 2: among lineups nearly as fair as the best, prefer stronger roles.
    const tolerance = Math.max(0, options.laneGapTolerance ?? DEFAULT_LANE_GAP_TOLERANCE);
    const ceiling = round(bestMaxGap + tolerance, 2);
    const results: BalanceCandidate[] = [];
    outsideBudget = fresh();
    visit(0, 0, () => ceiling, () => {
      insertCandidate(results, createCandidate(players, strengths, chosen, weights), limit);
    });
    return results;
  }

  // If role limits make the full in-group matchups impossible, relax one lane at a time.
  const maxRelax = Math.max(0, ...groupSizes.map((size) => Math.floor(size / 2)));
  for (let relax = 0; relax <= maxRelax; relax++) {
    const results = search(relax);
    if (results.length > 0) return results;
  }
  throw new NoValidAssignmentError();
}

export function validateManualAssignment(
  players: BalancePlayer[],
  assignments: Array<{ playerId: string; team: Team; role: Role }>,
  separationRules: SeparationRule[] = [],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): BalanceCandidate {
  if (players.length !== 10 || assignments.length !== 10) throw new Error("정확히 10명의 배정이 필요합니다.");
  const playerMap = new Map(players.map((player, index) => [player.id, { player, index }]));
  const seen = new Set<string>();
  const pairs = new Map<Role, Partial<Pair>>();
  for (const assignment of assignments) {
    const entry = playerMap.get(assignment.playerId);
    if (!entry || seen.has(assignment.playerId)) throw new Error("존재하지 않거나 중복된 플레이어 배정입니다.");
    if (entry.player.roleSkills[assignment.role] === 0) throw new Error(`${entry.player.name} 님은 ${assignment.role} 포지션을 플레이할 수 없습니다.`);
    seen.add(assignment.playerId);
    const pair = pairs.get(assignment.role) ?? {};
    if (assignment.team === "BLUE") {
      if (pair.blueIndex !== undefined) throw new Error(`BLUE 팀의 ${assignment.role} 포지션이 중복되었습니다.`);
      pair.blueIndex = entry.index;
    } else {
      if (pair.redIndex !== undefined) throw new Error(`RED 팀의 ${assignment.role} 포지션이 중복되었습니다.`);
      pair.redIndex = entry.index;
    }
    pair.role = assignment.role;
    pairs.set(assignment.role, pair);
  }
  const blueIds = new Set(assignments.filter((a) => a.team === "BLUE").map((a) => a.playerId));
  const redIds = new Set(assignments.filter((a) => a.team === "RED").map((a) => a.playerId));
  if (blueIds.size !== 5 || redIds.size !== 5 || ROLES.some((role) => !pairs.get(role)?.blueIndex || !pairs.get(role)?.redIndex)) {
    // Index zero is valid, so do an explicit check below.
    for (const role of ROLES) {
      const pair = pairs.get(role);
      if (pair?.blueIndex === undefined || pair.redIndex === undefined) throw new Error("각 팀에는 포지션별로 정확히 한 명이 필요합니다.");
    }
    if (blueIds.size !== 5 || redIds.size !== 5) throw new Error("각 팀은 정확히 5명이어야 합니다.");
  }
  for (const rule of separationRules) {
    if ((blueIds.has(rule.playerAId) && blueIds.has(rule.playerBId)) || (redIds.has(rule.playerAId) && redIds.has(rule.playerBId))) {
      throw new Error("비공개 팀 편성 조건을 만족하지 않는 배정입니다.");
    }
  }
  const strengths = players.map((player) => Object.fromEntries(ROLES.map((role) => [role, roleStrength(player, role, weights)])) as Record<Role, number>);
  return createCandidate(players, strengths, ROLES.map((role) => {
    const pair = pairs.get(role)! as Pair;
    return { ...pair, gap: round(Math.abs(strengths[pair.blueIndex][role] - strengths[pair.redIndex][role]), 2) };
  }), weights);
}

function createCandidate(players: BalancePlayer[], strengths: Record<Role, number>[], pairs: Pair[], weights: ScoringWeights): BalanceCandidate {
  const blue: PlayerAssignment[] = [];
  const red: PlayerAssignment[] = [];
  const laneGaps = {} as Record<Role, number>;
  let blueTotal = 0, redTotal = 0, satisfaction = 0, main = 0;
  for (const pair of pairs) {
    laneGaps[pair.role] = pair.gap;
    for (const [team, index] of [["BLUE", pair.blueIndex], ["RED", pair.redIndex]] as const) {
      const player = players[index];
      const strength = strengths[index][pair.role];
      const proficiency = player.roleSkills[pair.role];
      const assignment: PlayerAssignment = { playerId: player.id, name: player.name, nickname: player.nickname, tagline: player.tagline, team, role: pair.role, roleStrength: strength, roleProficiency: proficiency };
      (team === "BLUE" ? blue : red).push(assignment);
      if (team === "BLUE") blueTotal += strength; else redTotal += strength;
      satisfaction += roleFactor(player, pair.role, weights);
      if (roleRank(player, pair.role) === 1) main += 1;
    }
  }
  const gaps = Object.values(laneGaps);
  const metrics: BalanceMetrics = {
    laneGaps,
    maximumLaneGap: Math.max(...gaps),
    squaredLaneGapSum: round(gaps.reduce((sum, gap) => sum + gap ** 2, 0), 2),
    blueTotalStrength: round(blueTotal, 2),
    redTotalStrength: round(redTotal, 2),
    totalStrengthDifference: round(Math.abs(blueTotal - redTotal), 2),
    mainRoleAssignments: main,
    secondaryRoleAssignments: 10 - main,
    roleSatisfaction: round(satisfaction, 4),
  };
  const deterministicKey = ROLES.map((role) => {
    const b = blue.find((a) => a.role === role)!; const r = red.find((a) => a.role === role)!;
    return `${role}:${b.playerId}:${r.playerId}`;
  }).join("|");
  return { blue, red, metrics, deterministicKey };
}

function compareCandidates(a: BalanceCandidate, b: BalanceCandidate) {
  return b.metrics.roleSatisfaction - a.metrics.roleSatisfaction ||
    a.metrics.maximumLaneGap - b.metrics.maximumLaneGap ||
    a.metrics.squaredLaneGapSum - b.metrics.squaredLaneGapSum ||
    a.metrics.totalStrengthDifference - b.metrics.totalStrengthDifference ||
    a.deterministicKey.localeCompare(b.deterministicKey);
}

function insertCandidate(results: BalanceCandidate[], candidate: BalanceCandidate, limit: number) {
  if (results.some((item) => item.deterministicKey === candidate.deterministicKey)) return;
  results.push(candidate); results.sort(compareCandidates);
  if (results.length > limit) results.pop();
}

function buildForbiddenMap(rules: SeparationRule[]) {
  const map = new Map<string, Set<string>>();
  for (const { playerAId, playerBId } of rules) {
    if (playerAId === playerBId) continue;
    if (!map.has(playerAId)) map.set(playerAId, new Set());
    if (!map.has(playerBId)) map.set(playerBId, new Set());
    map.get(playerAId)!.add(playerBId); map.get(playerBId)!.add(playerAId);
  }
  return map;
}

function hasTeamConflict(playerId: string, team: Set<string>, forbidden: Map<string, Set<string>>) {
  const blocked = forbidden.get(playerId);
  return blocked ? [...team].some((id) => blocked.has(id)) : false;
}

function round(value: number, digits: number) {
  const scale = 10 ** digits; return Math.round(value * scale) / scale;
}

