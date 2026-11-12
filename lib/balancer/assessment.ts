import type { BalanceMetrics } from "@/lib/domain";

export type BalanceAssessment = {
  score: number;
  label: "추천" | "적정" | "비추천";
  laneScore: number;
  teamScore: number;
  roleScore: number;
};

/** A presentation score only; candidate selection still uses strict lexicographic priorities. */
export function assessBalance(metrics: BalanceMetrics): BalanceAssessment {
  const laneScore = clamp(100 - metrics.maximumLaneGap * 4);
  const teamScore = clamp(100 - metrics.totalStrengthDifference * 3);
  const roleScore = clamp(metrics.roleSatisfaction * 10);
  const score = Math.round(laneScore * 0.5 + teamScore * 0.3 + roleScore * 0.2);
  return { score, label: score >= 80 ? "추천" : score >= 60 ? "적정" : "비추천", laneScore: round(laneScore), teamScore: round(teamScore), roleScore: round(roleScore) };
}

function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function round(value: number) { return Math.round(value * 10) / 10; }
