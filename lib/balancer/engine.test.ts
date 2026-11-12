import { describe, expect, it } from "vitest";
import { generateBalancedTeams, NoValidAssignmentError, validateManualAssignment } from "./engine";
import type { BalancePlayer, RoleSkills, SeparationRule } from "@/lib/domain";
import { normalizedRank } from "./scoring";

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

  it("prioritizes maximum lane gap over total strength equality", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i, i === 4 ? 100 : 60 + i));
    const results = generateBalancedTeams(players, [], { limit: 5 });
    for (let i = 1; i < results.length; i++) expect(results[i].metrics.maximumLaneGap).toBeGreaterThanOrEqual(results[0].metrics.maximumLaneGap);
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
    expect(best.metrics.maximumLaneGap).toBeLessThan(25);
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
});

