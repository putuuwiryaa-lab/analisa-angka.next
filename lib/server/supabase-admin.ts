import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

/**
 * Supabase client dengan SERVICE ROLE key.
 * Melewati RLS — HANYA boleh dipakai di server (route handlers).
 * Jangan pernah diimpor dari komponen client.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
