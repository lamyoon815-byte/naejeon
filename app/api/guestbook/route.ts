import { apiOk, handleApiError } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { guestbookInputSchema } from "@/lib/validation";

type Row = { id: string; author_name: string; body: string; color: number; created_at: string };
const COLUMNS = "id,author_name,body,color,created_at";
const toEntry = (row: Row) => ({ id: row.id, authorName: row.author_name, body: row.body, color: row.color, createdAt: row.created_at });

// Public: latest guestbook notes.
export async function GET() {
  try {
    const { data, error } = await createAdminClient().from("guestbook_entries").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return apiOk(((data ?? []) as Row[]).map(toEntry));
  } catch (error) { return handleApiError(error); }
}

// Public: leave a note.
export async function POST(request: Request) {
  try {
    const input = guestbookInputSchema.parse(await request.json());
    const { data, error } = await createAdminClient().from("guestbook_entries")
      .insert({ author_name: input.authorName, body: input.body, color: input.color }).select(COLUMNS).single();
    if (error) throw error;
    return apiOk(toEntry(data as Row), { status: 201 });
  } catch (error) { return handleApiError(error); }
}
