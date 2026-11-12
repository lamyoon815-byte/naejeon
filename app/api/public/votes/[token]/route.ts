import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";

const voteSchema = z.object({ voterToken: z.string().uuid(), optionIndex: z.number().int().min(1).max(3) });

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!/^[a-f0-9]{64}$/i.test(token)) return apiError("NOT_FOUND", "투표를 찾을 수 없습니다.", 404);
    const supabase = createAdminClient();
    const { data: session } = await supabase.from("match_sessions").select("id,voting_enabled").eq("voting_token", token).maybeSingle();
    if (!session?.voting_enabled) return apiError("NOT_FOUND", "투표가 없거나 종료되었습니다.", 404);
    const [{ data: options, error }, { data: votes }] = await Promise.all([
      supabase.from("match_candidate_options").select("id,option_index,candidate,metrics").eq("match_session_id", session.id).order("option_index"),
      supabase.from("match_candidate_votes").select("option_id").eq("match_session_id", session.id),
    ]);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const vote of votes ?? []) counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
    return apiOk({ options: (options ?? []).map((option) => ({ optionIndex: option.option_index, votes: counts.get(option.id) ?? 0, metrics: option.metrics, teams: sanitizeCandidate(option.candidate) })), totalVotes: (votes ?? []).length });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const input = voteSchema.parse(await request.json());
    const { token } = await params;
    const supabase = createAdminClient();
    const { data: session } = await supabase.from("match_sessions").select("id,voting_enabled").eq("voting_token", token).maybeSingle();
    if (!session?.voting_enabled) return apiError("NOT_FOUND", "투표가 없거나 종료되었습니다.", 404);
    const { data: option } = await supabase.from("match_candidate_options").select("id").eq("match_session_id", session.id).eq("option_index", input.optionIndex).maybeSingle();
    if (!option) return apiError("BAD_REQUEST", "유효하지 않은 후보입니다.", 400);
    const { error } = await supabase.from("match_candidate_votes").upsert({ match_session_id: session.id, option_id: option.id, voter_token: input.voterToken }, { onConflict: "match_session_id,voter_token" });
    if (error) throw error;
    return apiOk({ voted: true, optionIndex: input.optionIndex });
  } catch (error) { return handleApiError(error); }
}

function sanitizeCandidate(candidate: { blue?: Array<Record<string, unknown>>; red?: Array<Record<string, unknown>> }) {
  const clean = (rows: Array<Record<string, unknown>> = []) => rows.map((row) => ({ name: row.name, nickname: row.nickname, tagline: row.tagline, role: row.role }));
  return { blue: clean(candidate.blue), red: clean(candidate.red) };
}
