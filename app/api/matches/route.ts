import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMatchSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { user } = await getViewer();
    const { playerIds } = createMatchSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: existing, error: playersError } = await supabase.from("players").select("id").in("id", playerIds).eq("is_active", true);
    if (playersError) throw playersError;
    if (existing?.length !== 10) return apiError("BAD_REQUEST", "활성 플레이어 10명을 선택해 주세요.", 400);
    const { data: session, error } = await supabase.from("match_sessions").insert({ created_by: user?.id ?? null }).select("id,status,created_at").single();
    if (error) throw error;
    const participants = playerIds.map((playerId, index) => ({ match_session_id: session.id, player_id: playerId, selection_order: index + 1 }));
    const { error: participantError } = await supabase.from("match_participants").insert(participants);
    if (participantError) { await supabase.from("match_sessions").delete().eq("id", session.id); throw participantError; }
    return apiOk({ id: session.id, status: session.status, createdAt: session.created_at, playerIds }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}

