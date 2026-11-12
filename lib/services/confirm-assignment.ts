import type { SupabaseClient } from "@supabase/supabase-js";
import { validateManualAssignment } from "@/lib/balancer/engine";
import { DEFAULT_SCORING_WEIGHTS } from "@/lib/balancer/scoring";
import type { Role, Team } from "@/lib/domain";
import { assignmentSnapshot, loadMatchContext } from "./matches";

export async function confirmAssignment(
  readClient: SupabaseClient,
  writeClient: SupabaseClient,
  matchId: string,
  assignments: Array<{ playerId: string; team: Team; role: Role }>,
  publish: boolean,
) {
  const { players, rules } = await loadMatchContext(readClient, matchId);
  const candidate = validateManualAssignment(players, assignments, rules);
  const shareToken = publish ? `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}` : null;
  // The RPC deliberately runs as the signed-in administrator. This preserves
  // the database-level admin check even though server-only reads use a secret.
  const { error } = await writeClient.rpc("confirm_match_assignment", {
    p_session_id: matchId,
    p_assignments: assignmentSnapshot(candidate, players),
    p_metrics: candidate.metrics,
    p_scoring_config: DEFAULT_SCORING_WEIGHTS,
    p_publish: publish,
    p_share_token: shareToken,
  });
  if (error) throw error;
  return { candidate, shareToken, publicPath: shareToken ? `/result/${shareToken}` : null };
}

