import { apiOk, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { error } = await createAdminClient().from("match_sessions").update({ share_enabled: false, share_token: null }).eq("id", id);
    if (error) throw error;
    return apiOk({ revoked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
