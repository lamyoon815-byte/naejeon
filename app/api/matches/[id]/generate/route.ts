import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { generateBalancedTeams, NoValidAssignmentError } from "@/lib/balancer/engine";
import { DEFAULT_SCORING_WEIGHTS } from "@/lib/balancer/scoring";
import { loadMatchContext, MatchNotFoundError } from "@/lib/services/matches";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const supabase = createAdminClient();
    const { players, rules } = await loadMatchContext(supabase, id);
    const candidates = generateBalancedTeams(players, rules, { limit: 5 });
    const votingToken = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    await supabase.from("match_candidate_options").delete().eq("match_session_id", id);
    const { error: optionsError } = await supabase.from("match_candidate_options").insert(candidates.slice(0, 3).map((candidate, index) => ({ match_session_id: id, option_index: index + 1, candidate, metrics: candidate.metrics })));
    if (optionsError) throw optionsError;
    const { error: sessionError } = await supabase.from("match_sessions").update({ status: "GENERATED", voting_token: votingToken, voting_enabled: true }).eq("id", id);
    if (sessionError) throw sessionError;
    return apiOk({ matchId: id, scoringConfig: DEFAULT_SCORING_WEIGHTS, candidates, votingPath: `/vote/${votingToken}` });
  } catch (error) {
    if (error instanceof MatchNotFoundError) return apiError("NOT_FOUND", "매치를 찾을 수 없습니다.", 404);
    if (error instanceof NoValidAssignmentError) return apiError("NO_VALID_ASSIGNMENT", error.message, 422);
    return handleApiError(error);
  }
}

