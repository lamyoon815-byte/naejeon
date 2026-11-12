import { apiError, apiOk, handleApiError } from "@/lib/api-response";
import { getViewer, requireAdmin } from "@/lib/auth";
import { toPlayerResponse, toPlayerColumns, toRoleSkillColumns, type PlayerRow } from "@/lib/data-mappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { playerInputSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    // Anyone may list active players; archived ones stay admin-only.
    const { isAdmin } = await getViewer();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const includeArchived = isAdmin && searchParams.get("includeArchived") === "true";
    let builder = createAdminClient().from("players").select("*,player_role_skills(*)").order("name");
    if (!includeArchived) builder = builder.eq("is_active", true);
    if (query) {
      const escaped = query.replaceAll("%", "\\%").replaceAll("_", "\\_");
      builder = builder.or(`name.ilike.%${escaped}%,nickname.ilike.%${escaped}%,tagline.ilike.%${escaped}%`);
    }
    const { data, error } = await builder;
    if (error) throw error;
    return apiOk(((data ?? []) as PlayerRow[]).map(toPlayerResponse));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = playerInputSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: player, error } = await supabase.from("players").insert(toPlayerColumns(input)).select("*").single();
    if (error?.code === "23505") return apiError("CONFLICT", "이미 등록된 닉네임입니다.", 409);
    if (error) throw error;
    const { error: skillError } = await supabase.from("player_role_skills").insert({ player_id: player.id, ...toRoleSkillColumns(input.roleSkills) });
    if (skillError) { await supabase.from("players").delete().eq("id", player.id); throw skillError; }
    const { data: created, error: readError } = await supabase.from("players").select("*,player_role_skills(*)").eq("id", player.id).single();
    if (readError) throw readError;
    return apiOk(toPlayerResponse(created as PlayerRow), { status: 201 });
  } catch (error) { return handleApiError(error); }
}

