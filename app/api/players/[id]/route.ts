import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { toPlayerColumns, toPlayerResponse, toRoleSkillColumns, type PlayerRow } from "@/lib/data-mappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { playerPatchSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const input = playerPatchSchema.parse(await request.json());
    const supabase = createAdminClient();
    const columns = toPlayerColumns(input);
    if (Object.keys(columns).length) {
      const { error } = await supabase.from("players").update(columns).eq("id", id);
      if (error?.code === "23505") return apiError("CONFLICT", "이미 등록된 닉네임입니다.", 409);
      if (error) throw error;
    }
    if (input.roleSkills) {
      const { error } = await supabase.from("player_role_skills").update(toRoleSkillColumns(input.roleSkills)).eq("player_id", id);
      if (error) throw error;
    }
    const { data, error } = await supabase.from("players").select("*,player_role_skills(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return apiError("NOT_FOUND", "플레이어를 찾을 수 없습니다.", 404);
    return apiOk(toPlayerResponse(data as PlayerRow));
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(_: Request, context: Context) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const { data, error } = await createAdminClient().from("players").update({ is_active: false }).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return apiError("NOT_FOUND", "플레이어를 찾을 수 없습니다.", 404);
    return apiOk({ id, archived: true });
  } catch (error) { return handleApiError(error); }
}

