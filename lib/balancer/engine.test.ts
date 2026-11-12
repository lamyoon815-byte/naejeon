import { describe, expect, it } from "vitest";
import { DEFAULT_LANE_GAP_TOLERANCE, generateBalancedTeams, NoValidAssignmentError, validateManualAssignment } from "./engine";
import type { BalancePlayer, RoleSkills, SeparationRule } from "@/lib/domain";
import { normalizedRank, roleStrength } from "./scoring";

const roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const;
function player(index: number, skill = 70, overrides: Partial<RoleSkills> = {}): BalancePlayer {
  const primary = roles[index % 5];
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `사람${index + 1}`,
    nickname: `P${index + 1}`,
    tagline: "KR1",
    rankTier: "GOLD", rankDivision: "II", rankLp: 50, customSkill: skill,
    roleSkills: { TOP: 1, JUNGLE: 1, MID: 1, ADC: 1, SUPPORT: 1, [primary]: 5, ...overrides },
  };
}

describe("team balancing engine", () => {
  it("scores Master rank in 200 LP brackets", () => {
    expect(normalizedRank("MASTER", null, 0)).toBe(90);
    expect(normalizedRank("MASTER", null, 100)).toBe(90);
    expect(normalizedRank("MASTER", null, 200)).toBe(95);
  });
  it("returns valid balanced standard matches", () => {
    const result = generateBalancedTeams(Array.from({ length: 10 }, (_, i) => player(i, 65 + (i % 3))), [], { limit: 3 });
    expect(result).toHaveLength(3);
    expect(result[0].blue).toHaveLength(5);
    expect(new Set(result[0].blue.map((a) => a.role))).toEqual(new Set(roles));
  });

  it("keeps every candidate within the lane-gap tolerance of the fairest lineup", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i, i === 4 ? 100 : 60 + i));
    const strict = generateBalancedTeams(players, [], { limit: 1, laneGapTolerance: 0 })[0];
    for (const result of generateBalancedTeams(players, [], { limit: 5 })) {
      expect(result.metrics.maximumLaneGap).toBeLessThanOrEqual(strict.metrics.maximumLaneGap + DEFAULT_LANE_GAP_TOLERANCE + 1e-9);
    }
  });

  it("does not offset a big tier gap with role proficiency (off-role Master vs main-role Gold)", () => {
    const master = player(0); master.rankTier = "MASTER"; master.rankDivision = null; master.rankLp = 200;
    master.roleSkills = { TOP: 2, JUNGLE: 5, MID: 0, ADC: 2, SUPPORT: 2 };
    const gold = player(1); gold.rankTier = "GOLD"; gold.rankDivision = "I"; gold.rankLp = 0;
    gold.roleSkills = { TOP: 4, JUNGLE: 5, MID: 1, ADC: 3, SUPPORT: 2 };
    expect(roleStrength(master, "TOP") - roleStrength(gold, "TOP")).toBeGreaterThan(10);
  });

  it("prefers main roles when lane fairness is equal", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i, 65));
    const best = generateBalancedTeams(players)[0];
    expect(best.metrics.mainRoleAssignments).toBe(10);
  });

  it("avoids an extreme support mismatch when a secondary assignment is fairer", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i, 65));
    players[4].customSkill = 100;
    players[4].rankTier = "MASTER";
    players[9].customSkill = 30;
    players[9].rankTier = "GOLD";
    players[3].roleSkills.SUPPORT = 4;
    players[8].roleSkills.SUPPORT = 4;
    const best = generateBalancedTeams(players)[0];
    const naiveSupportGap = roleStrength(players[4], "SUPPORT") - roleStrength(players[9], "SUPPORT");
    expect(best.metrics.maximumLaneGap).toBeLessThan(naiveSupportGap);
  });

  it("satisfies one and multiple mandatory separation rules", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i));
    const rules: SeparationRule[] = [
      { playerAId: players[0].id, playerBId: players[1].id },
      { playerAId: players[2].id, playerBId: players[3].id },
    ];
    const results = generateBalancedTeams(players, rules);
    for (const result of results) {
      const blue = new Set(result.blue.map((a) => a.playerId));
      const red = new Set(result.red.map((a) => a.playerId));
      for (const rule of rules) expect((blue.has(rule.playerAId) && blue.has(rule.playerBId)) || (red.has(rule.playerAId) && red.has(rule.playerBId))).toBe(false);
    }
  });

  it("never assigns a player to a role with proficiency zero", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i));
    players[0].roleSkills.JUNGLE = 0;
    for (const result of generateBalancedTeams(players)) {
      expect([...result.blue, ...result.red].find((a) => a.playerId === players[0].id)?.role).not.toBe("JUNGLE");
    }
  });

  it("rejects a manual assignment if its assigned role is changed to zero", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i));
    const generated = generateBalancedTeams(players)[0];
    const target = generated.blue[0];
    players.find((item) => item.id === target.playerId)!.roleSkills[target.role] = 0;
    const assignments = [...generated.blue, ...generated.red].map(({ playerId, team, role }) => ({ playerId, team, role }));
    expect(() => validateManualAssignment(players, assignments)).toThrow("플레이할 수 없습니다");
  });

  it("returns a structured failure when role constraints are impossible", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i));
    for (const p of players) p.roleSkills.JUNGLE = 0;
    expect(() => generateBalancedTeams(players)).toThrow(NoValidAssignmentError);
  });

  it("rejects a manual assignment that violates a separation rule", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i));
    const generated = generateBalancedTeams(players)[0];
    const assignments = [...generated.blue, ...generated.red].map(({ playerId, team, role }) => ({ playerId, team, role }));
    const sameTeam = generated.blue.slice(0, 2);
    expect(() => validateManualAssignment(players, assignments, [{ playerAId: sameTeam[0].playerId, playerBId: sameTeam[1].playerId }])).toThrow("비공개");
  });
  it("lanes matchup-group members against each other when possible", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i, 60 + i * 3));
    const group = [players[1].id, players[3].id, players[8].id];
    const result = generateBalancedTeams(players, [], { matchupGroups: [{ name: "g", playerIds: group }] })[0];
    const opponents = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map((role) => [
      result.blue.find((a) => a.role === role)!.playerId, result.red.find((a) => a.role === role)!.playerId,
    ]);
    const inGroupLanes = opponents.filter(([b, r]) => group.includes(b) && group.includes(r)).length;
    expect(inGroupLanes).toBe(1);
  });

  it("relaxes a matchup group instead of failing when roles make it impossible", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i));
    players[0].roleSkills = { TOP: 5, JUNGLE: 0, MID: 0, ADC: 0, SUPPORT: 0 };
    players[1].roleSkills = { TOP: 0, JUNGLE: 5, MID: 0, ADC: 0, SUPPORT: 0 };
    expect(generateBalancedTeams(players, [], { matchupGroups: [{ name: "g", playerIds: [players[0].id, players[1].id] }] })).not.toHaveLength(0);
  });
  it("ranks a higher-LP Master above a lower one on their second-best role, however the rater scaled it", () => {
    const harsh = player(0); harsh.rankTier = "MASTER"; harsh.rankDivision = null; harsh.rankLp = 200;
    harsh.roleSkills = { TOP: 2, JUNGLE: 5, MID: 0, ADC: 2, SUPPORT: 2 };
    const generous = player(1); generous.rankTier = "MASTER"; generous.rankDivision = null; generous.rankLp = 0;
    generous.roleSkills = { TOP: 4, JUNGLE: 2, MID: 5, ADC: 3, SUPPORT: 3 };
    expect(roleStrength(harsh, "TOP")).toBeGreaterThan(roleStrength(generous, "TOP"));
  });

  it("caps a barely-played role (proficiency 1) even when it ranks high", () => {
    const oneTrick = player(0, 50, { TOP: 1, JUNGLE: 1, MID: 5, ADC: 1, SUPPORT: 3 });
    expect(roleStrength(oneTrick, "TOP")).toBeLessThanOrEqual(roleStrength(oneTrick, "MID") * 0.8 + 1e-9);
  });
  it("uses an organizer override for one role but still respects a forbidden role", () => {
    const p = player(0, 50, { MID: 5, TOP: 0 });
    p.roleOverrides = { MID: 86, TOP: 99 };
    expect(roleStrength(p, "MID")).toBe(86);
    expect(roleStrength(p, "TOP")).toBe(Number.NEGATIVE_INFINITY);
  });
});

