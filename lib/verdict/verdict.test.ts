import { describe, expect, it } from "vitest";
import type { BalancePlayer } from "@/lib/domain";
import { buildVerdicts } from "./verdict";

const mk = (i: number, tier: BalancePlayer["rankTier"], division: BalancePlayer["rankDivision"], skills: BalancePlayer["roleSkills"]): BalancePlayer => ({
  id: `p${i}`, name: `선수${i}`, nickname: null, tagline: null, rankTier: tier, rankDivision: division, rankLp: 0, customSkill: 50, roleSkills: skills,
});
const all = { TOP: 5, JUNGLE: 4, MID: 4, ADC: 4, SUPPORT: 4 };

describe("규pt verdicts", () => {
  const players = [mk(1, "GOLD", "IV", all), mk(2, "EMERALD", "IV", all), mk(3, "DIAMOND", "IV", all), mk(4, "EMERALD", "IV", { ...all, MID: 0 })];
  const first = <T,>(items: readonly T[]) => items[0];

  it("places the player between a weaker and a stronger player without numbers", () => {
    const lines = buildVerdicts(players[1], players, first, 5);
    expect(lines.some((line) => line.includes("선수1") && line.includes("선수3"))).toBe(true);
    expect(lines.join(" ")).not.toMatch(/\d+\.\d|점/);
  });

  it("mentions a forbidden lane only as forbidden", () => {
    const lines = buildVerdicts(players[3], players, first, 5);
    const mid = lines.filter((line) => line.includes("미드"));
    expect(mid.every((line) => line.includes("🚫"))).toBe(true);
  });
});
