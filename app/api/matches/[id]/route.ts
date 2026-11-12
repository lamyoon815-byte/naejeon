import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const supabase = createAdminClient();
    const { data: session, error } = await supabase.from("match_sessions").select("id,status,created_at,share_enabled,published_at").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!session) return apiError("NOT_FOUND", "매치를 찾을 수 없습니다.", 404);
    const [{ data: participants }, { data: assignments }, { data: snapshot }] = await Promise.all([
      supabase.from("match_participants").select("player_id,selection_order,players(name,nickname,tagline)").eq("match_session_id", id).order("selection_order"),
      supabase.from("team_assignments").select("player_id,team,assigned_role,role_strength,role_proficiency,player_name_snapshot,nickname_snapshot,tagline_snapshot").eq("match_session_id", id),
      supabase.from("match_assignment_snapshots").select("metrics,scoring_config").eq("match_session_id", id).maybeSingle(),
    ]);
    return apiOk({ ...session, participants: participants ?? [], assignments: assignments ?? [], metrics: snapshot?.metrics ?? null, scoringConfig: snapshot?.scoring_config ?? null });
  } catch (error) { return handleApiError(error); }
}

