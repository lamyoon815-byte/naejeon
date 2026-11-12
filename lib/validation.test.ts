import { describe, expect, it } from "vitest";
import { playerInputSchema } from "./validation";

const basePlayer = {
  name: "규린",
  nickname: "Poro",
  rankTier: "GOLD" as const,
  rankDivision: "IV" as const,
  rankLp: 0,
  customSkill: 50,
  roleSkills: { TOP: 1, JUNGLE: 1, MID: 1, ADC: 1, SUPPORT: 1 },
};

describe("player identity validation", () => {
  it("stores a Riot tag without its leading hash", () => {
    expect(playerInputSchema.parse({ ...basePlayer, tagline: "#KR1" }).tagline).toBe("KR1");
  });

  it("allows nickname and tag to be omitted", () => {
    expect(playerInputSchema.parse({ ...basePlayer, nickname: null, tagline: null })).toMatchObject({ nickname: null, tagline: null });
  });

  it("requires a nickname when a tag is present", () => {
    expect(() => playerInputSchema.parse({ ...basePlayer, nickname: null, tagline: "KR1" })).toThrow();
  });
});
