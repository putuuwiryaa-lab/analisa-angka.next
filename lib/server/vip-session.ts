import "server-only";
import { getBearerToken, TOKEN_VERSION, verifyToken } from "@/lib/server/jwt";
import { createAdminClient } from "@/lib/server/supabase-admin";

export type VipSessionResult =
  | { ok: true; role: "PRO" | "MASTER"; accountId: string; phone: string }
  | { ok: false; status: number; error: string };

export async function verifyActiveVipSession(headers: Headers): Promise<VipSessionResult> {
  const token = getBearerToken(headers);
  if (!token || token === "null" || token === "undefined") {
    return { ok: false, status: 401, error: "Token tidak ditemukan" };
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return { ok: false, status: 401, error: "Token tidak valid" };
  }

  if (decoded.tokenVersion !== TOKEN_VERSION) {
    return { ok: false, status: 401, error: "Sesi lama. Silakan login ulang." };
  }

  const role = String(decoded.role || "");
  if (!["PRO", "MASTER"].includes(role)) {
    return { ok: false, status: 403, error: "Akses tidak valid" };
  }

  const accountId = String(decoded.accountId || "");
  const phone = String(decoded.phone || "");
  const sessionId = String(decoded.sessionId || "");

  if (!accountId || !phone || !sessionId) {
    return { ok: false, status: 401, error: "Sesi VIP tidak lengkap. Silakan login ulang." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vip_profiles")
    .select("user_id,phone,role,expires_at,is_active,active_session_id,suspended_at")
    .eq("user_id", accountId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "Gagal memeriksa sesi VIP" };
  }

  if (!data || data.phone !== phone) {
    return { ok: false, status: 403, error: "Profile VIP tidak ditemukan" };
  }

  if (!data.is_active || data.suspended_at) {
    return { ok: false, status: 403, error: "Akun VIP tidak aktif" };
  }

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 403, error: "Masa aktif VIP sudah habis" };
  }

  if (data.active_session_id !== sessionId) {
    return { ok: false, status: 401, error: "Sesi VIP sudah aktif di perangkat lain. Silakan login ulang." };
  }

  return { ok: true, role: role as "PRO" | "MASTER", accountId, phone };
}
