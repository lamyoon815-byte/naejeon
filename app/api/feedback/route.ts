import { apiOk, handleApiError } from "@/lib/api-response";
import type { BalanceCandidate, Role } from "@/lib/domain";
import { ROLES } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedbackInputSchema } from "@/lib/validation";

type LineupRow = { role: Role; blue: string; red: string };
type FeedbackRow = { id: string; match_session_id: string | null; author_name: string | null; body: string; created_at: string; lineup: LineupRow[] | null };
const COLUMNS = "id,match_session_id,author_name,body,created_at,lineup";

const toFeedback = (row: FeedbackRow, fallback?: LineupRow[]) => ({
  id: row.id, matchId: row.match_session_id, authorName: row.author_name, body: row.body, createdAt: row.created_at,
  lineup: row.lineup ?? fallback ?? null,
  // Older comments were saved without a snapshot; show the match's first candidate instead.
  lineupIsGuess: !row.lineup && Boolean(fallback),
});

function lineupOf(candidate: BalanceCandidate): LineupRow[] {
  return ROLES.map((role) => ({
    role,
    blue: candidate.blue.find((a) => a.role === role)?.name ?? "?",
    red: candidate.red.find((a) => a.role === role)?.name ?? "?",
  }));
}

// Public: list feedback, for one match (?matchId=) or the latest overall.
export async function GET(request: Request) {
  try {
    const matchId = new URL(request.url).searchParams.get("matchId");
    const supabase = createAdminClient();
    let builder = supabase.from("feedback_comments").select(COLUMNS).order("created_at", { ascending: false }).limit(100);
    if (matchId) builder = builder.eq("match_session_id", matchId);
    const { data, error } = await builder;
    if (error) throw error;
    const rows = (data ?? []) as FeedbackRow[];
    const missing = [...new Set(rows.filter((row) => !row.lineup && row.match_session_id).map((row) => row.match_session_id!))];
    const fallbacks = new Map<string, LineupRow[]>();
    if (missing.length) {
      const { data: options } = await supabase.from("match_candidate_options").select("match_session_id,candidate").eq("option_index", 1).in("match_session_id", missing);
      for (const option of options ?? []) fallbacks.set(option.match_session_id, lineupOf(option.candidate as BalanceCandidate));
    }
    return apiOk(rows.map((row) => toFeedback(row, row.match_session_id ? fallbacks.get(row.match_session_id) : undefined)));
  } catch (error) { return handleApiError(error); }
}

// Public: leave a comment, with the lineup the visitor was looking at.
export async function POST(request: Request) {
  try {
    const input = feedbackInputSchema.parse(await request.json());
    const { data, error } = await createAdminClient().from("feedback_comments")
      .insert({ match_session_id: input.matchId, author_name: input.authorName, body: input.body, lineup: input.lineup })
      .select(COLUMNS).single();
    if (error) throw error;
    return apiOk(toFeedback(data as FeedbackRow), { status: 201 });
  } catch (error) { return handleApiError(error); }
}
