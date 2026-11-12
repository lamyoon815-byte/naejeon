import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { data, error } = await createAdminClient().from("player_separation_rules").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return apiError("NOT_FOUND", "분리 조건을 찾을 수 없습니다.", 404);
    return apiOk({ id, deleted: true });
  } catch (error) { return handleApiError(error); }
}

