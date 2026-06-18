import "server-only";
import crypto from "crypto";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireEnv } from "@/lib/server/env";
import { getBearerToken, TOKEN_VERSION, verifyToken, type Role } from "@/lib/server/jwt";

const DEVICE_HEADER = "x-aa-device-id";

type TelegramPlan = "NONE" | "TRIAL" | "PRO";
type AccessRole = Extract<Role, "TRIAL" | "PRO" | "SUPER">;

type TelegramUserRow = {
  id: string;
  telegram_user_id: number;
  plan: TelegramPlan;
  trial_expires_at: string | null;
  pro_expires_at: string | null;
  is_active: boolean;
  suspended_at: string | null;
  active_session_id: string | null;
  active_device_hash: string | null;
  active_device_user_agent_hash: string | null;
};

export type TelegramSessionResult =
  | {
      ok: true;
      role: AccessRole;
      accountId: string;
      telegramUserId: number;
      expiresAt: string;
      sessionId: string;
      deviceBound: boolean;
    }
  | { ok: false; status: number; error: string };

function isFutureDate(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function normalizeDeviceId(value: string | null) {
  return String(value || "").trim().slice(0, 120);
}

function hashValue(value: string) {
  return crypto.createHmac("sha256", requireEnv("JWT_SECRET")).update(value).digest("hex");
}

function tokenExpiresAt(exp?: number) {
  return typeof exp === "number"
    ? new Date(exp * 1000).toISOString()
    : "9999-12-31T00:00:00.000Z";
}

export async function verifyActiveTelegramSession(headers: Headers): Promise<TelegramSessionResult> {
  const token = getBearerToken(headers);

  if (!token || token === "null" || token === "undefined") {
    return { ok: false, status: 401, error: "Silakan login terlebih dahulu." };
  }

  const userAgentHash = hashValue(headers.get("user-agent") || "unknown");
  const deviceId = normalizeDeviceId(headers.get(DEVICE_HEADER));
  const deviceHash = deviceId ? hashValue(deviceId) : "";

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
  if (role !== "TRIAL" && role !== "PRO" && role !== "SUPER") {
    return { ok: false, status: 403, error: "Akses tidak valid." };
  }

  const accountId = String(payload.accountId || "");
  const sessionId = String(payload.sessionId || "");

  if (!accountId || !sessionId) {
    return { ok: false, status: 401, error: "Session tidak lengkap. Silakan login ulang." };
  }

  if (role === "SUPER") {
    const tokenDeviceHash = String(payload.deviceHash || "");
    const tokenUserAgentHash = String(payload.userAgentHash || "");

    if (tokenDeviceHash && (!deviceHash || tokenDeviceHash !== deviceHash)) {
      return { ok: false, status: 401, error: "Akun sedang aktif di device lain. Silakan login ulang." };
    }

    if (!tokenDeviceHash && tokenUserAgentHash && tokenUserAgentHash !== userAgentHash) {
      return { ok: false, status: 401, error: "Device tidak valid. Silakan login ulang." };
    }

    return {
      ok: true,
      role: "SUPER",
      accountId,
      telegramUserId: 0,
      expiresAt: tokenExpiresAt(payload.exp),
      sessionId,
      deviceBound: Boolean(tokenDeviceHash),
    };
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("telegram_users")
    .select("id, telegram_user_id, plan, trial_expires_at, pro_expires_at, is_active, suspended_at, active_session_id, active_device_hash, active_device_user_agent_hash")
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

  if (user.active_device_hash && !deviceHash && user.active_device_user_agent_hash !== userAgentHash) {
    return { ok: false, status: 401, error: "Device tidak valid. Silakan login ulang." };
  }

  if (user.active_device_hash && deviceHash && user.active_device_hash !== deviceHash) {
    return { ok: false, status: 401, error: "Akun sedang aktif di device lain. Silakan login ulang." };
  }

  let deviceBound = Boolean(user.active_device_hash);

  if (!user.active_device_hash && deviceHash) {
    const { error: bindError } = await supabase
      .from("telegram_users")
      .update({
        active_device_hash: deviceHash,
        active_device_at: new Date().toISOString(),
        active_device_user_agent_hash: userAgentHash,
      })
      .eq("id", user.id)
      .eq("active_session_id", sessionId);

    if (bindError) {
      return { ok: false, status: 500, error: "Gagal mengunci device." };
    }

    deviceBound = true;
  }

  const expiresAt = role === "PRO" ? user.pro_expires_at : user.trial_expires_at;

  if (!isFutureDate(expiresAt)) {
    return { ok: false, status: 403, error: "Masa akses sudah habis." };
  }

  return {
    ok: true,
    role: role as Extract<Role, "TRIAL" | "PRO">,
    accountId,
    telegramUserId: user.telegram_user_id,
    expiresAt: expiresAt as string,
    sessionId,
    deviceBound,
  };
}
