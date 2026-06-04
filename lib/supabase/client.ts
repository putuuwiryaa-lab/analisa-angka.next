import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client dengan ANON key — aman untuk browser.
 * Akses dibatasi sepenuhnya oleh Row Level Security (RLS) di Supabase.
 * Dipakai untuk baca data publik: markets, evaluations, statistics.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
