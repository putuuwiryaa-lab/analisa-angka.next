import { createAdminClient } from "@/lib/server/supabase-admin";

export async function verifyVipProfile(userId: string, phone: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vip_profiles")
    .select("user_id, phone, role, expires_at, is_active, suspended_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.phone !== phone) return { ok: false as const, error: "Profile VIP tidak ditemukan" };
  if (!data.is_active || data.suspended_at) return { ok: false as const, error: "Akun VIP tidak aktif" };
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, error: "Masa aktif VIP sudah habis" };
  }
  if (!["PRO", "MASTER"].includes(String(data.role || ""))) {
    return { ok: false as const, error: "Role VIP tidak valid" };
  }

  return { ok: true as const, profile: data };
}
