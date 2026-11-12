import "server-only";
import { AuthError } from "./api-response";
import { createClient } from "./supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError("UNAUTHORIZED", "관리자 로그인이 필요합니다.", 401);
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) throw new AuthError("FORBIDDEN", "관리자 권한이 없습니다.", 403);
  return user;
}

