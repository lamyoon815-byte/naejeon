import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { playerSelect, toBalancePlayer, type PlayerRow } from "@/lib/data-mappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildVerdicts } from "@/lib/verdict/verdict";

// Public: number-free comparisons for one player (random each call).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await createAdminClient().from("players").select(playerSelect(true)).eq("is_active", true);
    if (error) throw error;
    const players = ((data ?? []) as unknown as PlayerRow[]).map(toBalancePlayer);
    const target = players.find((p) => p.id === id);
    if (!target) return apiError("NOT_FOUND", "플레이어를 찾을 수 없습니다.", 404);
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
    return apiOk({ name: target.name, verdicts: buildVerdicts(target, players, pick) });
  } catch (error) { return handleApiError(error); }
}
