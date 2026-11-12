import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnv, secretSupabaseKey } from "./env";

export function createAdminClient() {
  const { url } = publicSupabaseEnv();
  return createClient(url, secretSupabaseKey(), { auth: { autoRefreshToken: false, persistSession: false } });
}

