import { apiOk, handleApiError } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedbackInputSchema } from "@/lib/validation";

type FeedbackRow = { id: string; match_session_id: string | null; author_name: string | null; body: string; created_at: string };
const toFeedback = (row: FeedbackRow) => ({ id: row.id, matchId: row.match_session_id, authorName: row.author_name, body: row.body, createdAt: row.created_at });

// Public: list feedback, for one match (?matchId=) or the latest overall.
export async function GET(request: Request) {
  try {
    const matchId = new URL(request.url).searchParams.get("matchId");
    let builder = createAdminClient().from("feedback_comments").select("id,match_session_id,author_name,body,created_at").order("created_at", { ascending: false }).limit(100);
    if (matchId) builder = builder.eq("match_session_id", matchId);
    const { data, error } = await builder;
    if (error) throw error;
    return apiOk(((data ?? []) as FeedbackRow[]).map(toFeedback));
  } catch (error) { return handleApiError(error); }
}

// Public: leave a comment.
export async function POST(request: Request) {
  try {
    const input = feedbackInputSchema.parse(await request.json());
    const { data, error } = await createAdminClient().from("feedback_comments")
      .insert({ match_session_id: input.matchId, author_name: input.authorName, body: input.body })
      .select("id,match_session_id,author_name,body,created_at").single();
    if (error) throw error;
    return apiOk(toFeedback(data as FeedbackRow), { status: 201 });
  } catch (error) { return handleApiError(error); }
}
