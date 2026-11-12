import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { playerSelect, toBalancePlayer, type PlayerRow } from "@/lib/data-mappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { phraseWithGemini } from "@/lib/verdict/gemini";
import { planVerdicts, renderTemplate } from "@/lib/verdict/verdict";

// Public: number-free comparisons for one player (random each call).
// The engine decides who is above/below; AI (if configured) only rewords it.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await createAdminClient().from("players").select(playerSelect(true)).eq("is_active", true);
    if (error) throw error;
    const players = ((data ?? []) as unknown as PlayerRow[]).map(toBalancePlayer);
    const target = players.find((p) => p.id === id);
    if (!target) return apiError("NOT_FOUND", "플레이어를 찾을 수 없습니다.", 404);
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
    const facts = planVerdicts(target, players, pick);
    if (facts.length === 0) return apiOk({ name: target.name, verdicts: ["규pt도 아직 당신을 잘 모르겠어요. 🤔"], source: "template" });
    const ai = await phraseWithGemini(facts);
    return apiOk({ name: target.name, verdicts: ai ?? facts.map((fact) => renderTemplate(fact, pick)), source: ai ? "ai" : "template" });
  } catch (error) { return handleApiError(error); }
}
