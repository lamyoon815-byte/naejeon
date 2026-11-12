import { z } from "zod";
import { RANK_TIERS, ROLES } from "@/lib/domain";

const division = z.enum(["I", "II", "III", "IV"]).nullable();
const tier = z.enum(RANK_TIERS);
const roleSkill = z.number().int().min(0).max(5);

export const roleSkillsSchema = z.object({
  TOP: roleSkill,
  JUNGLE: roleSkill,
  MID: roleSkill,
  ADC: roleSkill,
  SUPPORT: roleSkill,
}).refine((skills) => Object.values(skills).some((value) => value > 0), "최소 한 포지션은 플레이 가능해야 합니다.");

const playerObjectSchema = z.object({
  name: z.string().trim().min(1).max(30),
  nickname: z.string().trim().max(30).nullable().optional().transform((value) => value === "" ? null : value),
  tagline: z.string().trim().max(10).nullable().optional()
    .transform((value) => value?.replace(/^#+/, "") || null)
    .refine((value) => !value || !/[#\s]/.test(value), "태그에는 # 또는 공백을 포함할 수 없습니다."),
  rankTier: tier,
  rankDivision: division,
  rankLp: z.number().int().min(0).max(5000).nullable().optional().default(null),
  customSkill: z.number().min(0).max(100),
  roleSkills: roleSkillsSchema,
});

export const playerInputSchema = playerObjectSchema.superRefine((value, ctx) => {
  const divisionTier = !["UNRANKED", "MASTER", "GRANDMASTER", "CHALLENGER"].includes(value.rankTier);
  if (divisionTier && !value.rankDivision) ctx.addIssue({ code: "custom", path: ["rankDivision"], message: "해당 티어에는 디비전이 필요합니다." });
  if (!divisionTier && value.rankDivision) ctx.addIssue({ code: "custom", path: ["rankDivision"], message: "해당 티어에는 디비전을 지정할 수 없습니다." });
  if (value.rankTier === "UNRANKED" && value.rankLp !== null) ctx.addIssue({ code: "custom", path: ["rankLp"], message: "언랭크 플레이어에게 LP를 지정할 수 없습니다." });
  if (value.tagline && !value.nickname) ctx.addIssue({ code: "custom", path: ["tagline"], message: "태그를 입력하려면 소환사 닉네임이 필요합니다." });
});

export const playerPatchSchema = playerObjectSchema.partial();
export const separationRuleSchema = z.object({ playerAId: z.string().uuid(), playerBId: z.string().uuid() }).refine((value) => value.playerAId !== value.playerBId, "같은 플레이어를 분리할 수 없습니다.");
export const createMatchSchema = z.object({ playerIds: z.array(z.string().uuid()).length(10).refine((ids) => new Set(ids).size === 10, "중복 참가자가 있습니다.") });
export const assignmentSchema = z.object({ playerId: z.string().uuid(), team: z.enum(["BLUE", "RED"]), role: z.enum(ROLES) });
export const confirmAssignmentSchema = z.object({ assignments: z.array(assignmentSchema).length(10), publish: z.boolean().optional().default(false) });


export const feedbackInputSchema = z.object({
  matchId: z.string().uuid().nullable().optional().default(null),
  authorName: z.string().trim().max(20).nullable().optional().transform((value) => value ? value : null),
  body: z.string().trim().min(1, "내용을 입력해 주세요.").max(500, "500자까지 쓸 수 있어요."),
  lineup: z.array(z.object({
    role: z.enum(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]),
    blue: z.string().trim().min(1).max(30),
    red: z.string().trim().min(1).max(30),
  })).max(5).nullable().optional().default(null),
});

export const guestbookInputSchema = z.object({
  authorName: z.string().trim().min(1, "이름을 입력해 주세요.").max(20, "이름은 20자까지예요."),
  body: z.string().trim().min(1, "내용을 입력해 주세요.").max(300, "300자까지 쓸 수 있어요."),
  color: z.number().int().min(0).max(4).optional().default(0),
});
