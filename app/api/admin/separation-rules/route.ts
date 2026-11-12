import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { separationRuleSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await createAdminClient().from("player_separation_rules").select("id,player_a_id,player_b_id,is_active,created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return apiOk((data ?? []).map((row) => ({ id: row.id, playerAId: row.player_a_id, playerBId: row.player_b_id, isActive: row.is_active, createdAt: row.created_at })));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = separationRuleSchema.parse(await request.json());
    const [playerAId, playerBId] = [input.playerAId, input.playerBId].sort();
    const { data, error } = await createAdminClient().from("player_separation_rules").insert({ player_a_id: playerAId, player_b_id: playerBId }).select("id,player_a_id,player_b_id,is_active,created_at").single();
    if (error?.code === "23505") return apiError("CONFLICT", "이미 등록된 분리 조건입니다.", 409);
    if (error) throw error;
    return apiOk({ id: data.id, playerAId: data.player_a_id, playerBId: data.player_b_id, isActive: data.is_active, createdAt: data.created_at }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}

