import { describe, expect, it } from "vitest";
import { assessBalance } from "./assessment";
import type { BalanceMetrics } from "@/lib/domain";

function metrics(maximumLaneGap: number, totalStrengthDifference: number, roleSatisfaction: number): BalanceMetrics {
  return { laneGaps: { TOP: 0, JUNGLE: 0, MID: 0, ADC: 0, SUPPORT: 0 }, maximumLaneGap, squaredLaneGapSum: 0, blueTotalStrength: 0, redTotalStrength: 0, totalStrengthDifference, mainRoleAssignments: 0, secondaryRoleAssignments: 10, roleSatisfaction };
}

describe("balance presentation assessment", () => {
  it("labels a highly balanced assignment as recommended", () => expect(assessBalance(metrics(2, 2, 9)).label).toBe("추천"));
  it("labels a severely uneven assignment as not recommended", () => expect(assessBalance(metrics(20, 20, 4)).label).toBe("비추천"));
  it("keeps its score in the 0 to 100 range", () => expect(assessBalance(metrics(999, 999, 0)).score).toBe(0));
});
