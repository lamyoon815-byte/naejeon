import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!/^[a-f0-9]{64}$/i.test(token)) return apiError("NOT_FOUND", "공유 결과를 찾을 수 없습니다.", 404);
    const supabase = createAdminClient();
    const { data: session, error } = await supabase.from("match_sessions").select("id,published_at").eq("share_token", token).eq("share_enabled", true).eq("status", "CONFIRMED").maybeSingle();
    if (error) throw error;
    if (!session) return apiError("NOT_FOUND", "공유 결과가 없거나 비활성화되었습니다.", 404);
    const [{ data: assignments }, { data: snapshot }] = await Promise.all([
      supabase.from("team_assignments").select("team,assigned_role,player_name_snapshot,nickname_snapshot,tagline_snapshot").eq("match_session_id", session.id).order("team").order("assigned_role"),
      supabase.from("match_assignment_snapshots").select("metrics").eq("match_session_id", session.id).single(),
    ]);
    return apiOk({ publishedAt: session.published_at, teams: (assignments ?? []).map((row) => ({ team: row.team, role: row.assigned_role, name: row.player_name_snapshot, nickname: row.nickname_snapshot, tagline: row.tagline_snapshot })), metrics: snapshot?.metrics ?? null });
  } catch (error) { return handleApiError(error); }
}

