import "server-only";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { getBearerToken, TOKEN_VERSION, verifyToken, type Role } from "@/lib/server/jwt";

type TelegramPlan = "NONE" | "TRIAL" | "PRO";
type AccessRole = Extract<Role, "TRIAL" | "PRO">;

type TelegramUserRow = {
  id: string;
  telegram_user_id: number;
  plan: TelegramPlan;
  trial_expires_at: string | null;
  pro_expires_at: string | null;
  is_active: boolean;
  suspended_at: string | null;
  active_session_id: string | null;
};

export type TelegramSessionResult =
  | {
      ok: true;
      role: AccessRole;
      accountId: string;
      telegramUserId: number;
      expiresAt: string;
      sessionId: string;
    }
  | { ok: false; status: number; error: string };

function isFutureDate(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

export async function verifyActiveTelegramSession(headers: Headers): Promise<TelegramSessionResult> {
  const token = getBearerToken(headers);

  if (!token || token === "null" || token === "undefined") {
    return { ok: false, status: 401, error: "Silakan login terlebih dahulu." };
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return { ok: false, status: 401, error: "Session tidak valid. Silakan login ulang." };
  }

  if (payload.tokenVersion !== TOKEN_VERSION) {
    return { ok: false, status: 401, error: "Session lama. Silakan login ulang." };
  }

  const role = String(payload.role || "");
  if (role !== "TRIAL" && role !== "PRO") {
    return { ok: false, status: 403, error: "Akses tidak valid." };
  }

  const accountId = String(payload.accountId || "");
  const sessionId = String(payload.sessionId || "");

  if (!accountId || !sessionId) {
    return { ok: false, status: 401, error: "Session tidak lengkap. Silakan login ulang." };
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("telegram_users")
    .select("id, telegram_user_id, plan, trial_expires_at, pro_expires_at, is_active, suspended_at, active_session_id")
    .eq("id", accountId)
    .maybeSingle<TelegramUserRow>();

  if (error) {
    return { ok: false, status: 500, error: "Gagal memeriksa session." };
  }

  if (!user) {
    return { ok: false, status: 401, error: "Akun tidak ditemukan. Silakan login ulang." };
  }

  if (!user.is_active || user.suspended_at) {
    return { ok: false, status: 403, error: "Akun sedang tidak aktif." };
  }

  if (user.active_session_id !== sessionId) {
    return { ok: false, status: 401, error: "Session sudah diganti perangkat lain. Silakan login ulang." };
  }

  const expiresAt = role === "PRO" ? user.pro_expires_at : user.trial_expires_at;

  if (!isFutureDate(expiresAt)) {
    return { ok: false, status: 403, error: "Masa akses sudah habis." };
  }

  return {
    ok: true,
    role,
    accountId,
    telegramUserId: user.telegram_user_id,
    expiresAt: expiresAt as string,
    sessionId,
  };
}
