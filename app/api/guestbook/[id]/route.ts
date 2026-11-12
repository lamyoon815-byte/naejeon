import { apiOk, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { error } = await createAdminClient().from("guestbook_entries").delete().eq("id", id);
    if (error) throw error;
    return apiOk({ deleted: true });
  } catch (error) { return handleApiError(error); }
}
