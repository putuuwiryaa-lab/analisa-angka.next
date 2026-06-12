import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireEnv } from "@/lib/server/env";
import { signToken, type Role } from "@/lib/server/jwt";
import { getClientIp } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRIAL_DAYS = 7;

type TelegramUserRow = {
  id: string;
  telegram_user_id: number;
  chat_id: number | null;
  plan: "NONE" | "TRIAL" | "PRO";
  trial_used: boolean;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  pro_started_at: string | null;
  pro_expires_at: string | null;
  is_active: boolean;
  suspended_at: string | null;
};

type LoginCodeRow = {
  id: string;
  user_id: string;
  telegram_user_id: number;
  chat_id: number | null;
  code_type: "LOGIN" | "TRIAL_LOGIN" | "PRO_LOGIN";
  expires_at: string;
  used_at: string | null;
};

function getCodeSecret() {
  return process.env.TELEGRAM_LOGIN_CODE_SECRET || requireEnv("TELEGRAM_WEBHOOK_SECRET");
}

function hashValue(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function hashLoginCode(code: string) {
  return crypto.createHash("sha256").update(`${getCodeSecret()}:${code}`).digest("hex");
}

function normalizeCode(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function normalizeDeviceId(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

function isFutureDate(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function secondsUntil(value: string) {
  const seconds = Math.floor((new Date(value).getTime() - Date.now()) / 1000);
  return Math.max(seconds, 60);
}

async function writeAccessEvent(params: {
  userId?: string | null;
  telegramUserId?: number | null;
  chatId?: number | null;
  eventType: string;
  eventDetail?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  userAgentHash?: string;
}) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("telegram_access_events").insert({
    user_id: params.userId || null,
    telegram_user_id: params.telegramUserId || null,
    chat_id: params.chatId || null,
    event_type: params.eventType,
    event_detail: params.eventDetail || null,
    metadata: params.metadata || {},
    ip_hash: params.ipHash || null,
    user_agent_hash: params.userAgentHash || null,
  });

  if (error) console.error("TELEGRAM_ACCESS_EVENT_ERROR", error);
}

async function failLogin(params: {
  status?: number;
  error: string;
  reason: string;
  code?: LoginCodeRow | null;
  ipHash: string;
  userAgentHash: string;
}) {
  await writeAccessEvent({
    userId: params.code?.user_id || null,
    telegramUserId: params.code?.telegram_user_id || null,
    chatId: params.code?.chat_id || null,
    eventType: "LOGIN_FAILED",
    eventDetail: params.reason,
    metadata: { reason: params.reason },
    ipHash: params.ipHash,
    userAgentHash: params.userAgentHash,
  });

  return NextResponse.json(
    { success: false, error: params.error },
    { status: params.status || 401 },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = normalizeCode(body.code);
  const deviceId = normalizeDeviceId(body.device_id);

  let jwtSecret = "";
  try {
    jwtSecret = requireEnv("JWT_SECRET");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.json(
      { success: false, error: "Kesalahan konfigurasi server" },
      { status: 500 },
    );
  }

  const ipHash = hashValue(getClientIp(request.headers), jwtSecret);
  const userAgentHash = hashValue(request.headers.get("user-agent") || "unknown", jwtSecret);
  const deviceHash = deviceId ? hashValue(deviceId, jwtSecret) : "";

  if (code.length !== 6) {
    return NextResponse.json(
      { success: false, error: "Kode login harus 6 digit" },
      { status: 400 },
    );
  }

  if (!deviceHash) {
    return NextResponse.json(
      { success: false, error: "Device tidak valid. Muat ulang halaman lalu coba lagi." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const codeHash = hashLoginCode(code);

    const { data: loginCode, error: codeError } = await supabase
      .from("telegram_login_codes")
      .select("id, user_id, telegram_user_id, chat_id, code_type, expires_at, used_at")
      .eq("code_hash", codeHash)
      .maybeSingle<LoginCodeRow>();

    if (codeError) throw codeError;

    if (!loginCode) {
      return failLogin({
        error: "Kode login tidak valid",
        reason: "code_not_found",
        ipHash,
        userAgentHash,
      });
    }

    if (loginCode.used_at) {
      return failLogin({
        error: "Kode login sudah digunakan",
        reason: "code_already_used",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    if (!isFutureDate(loginCode.expires_at)) {
      return failLogin({
        error: "Kode login sudah kedaluwarsa",
        reason: "code_expired",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    const { data: user, error: userError } = await supabase
      .from("telegram_users")
      .select(
        "id, telegram_user_id, chat_id, plan, trial_used, trial_started_at, trial_expires_at, pro_started_at, pro_expires_at, is_active, suspended_at",
      )
      .eq("id", loginCode.user_id)
      .maybeSingle<TelegramUserRow>();

    if (userError) throw userError;

    if (!user) {
      return failLogin({
        error: "Akun Telegram tidak ditemukan",
        reason: "telegram_user_not_found",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    if (!user.is_active || user.suspended_at) {
      return failLogin({
        status: 403,
        error: "Akun Telegram sedang tidak aktif",
        reason: "telegram_user_inactive",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    const now = new Date();
    const sessionId = crypto.randomUUID();
    const trialActive = user.plan === "TRIAL" && isFutureDate(user.trial_expires_at);
    const proActive = user.plan === "PRO" && isFutureDate(user.pro_expires_at);

    let role: Role = "TRIAL";
    let expiresAt = user.trial_expires_at;
    let loginReason = "login_success";
    let updatePayload: Record<string, unknown> = {
      active_session_id: sessionId,
      active_session_at: now.toISOString(),
      active_device_hash: deviceHash,
      active_device_at: now.toISOString(),
      active_device_user_agent_hash: userAgentHash,
      last_seen_at: now.toISOString(),
    };

    if (loginCode.code_type === "TRIAL_LOGIN" && !user.trial_used) {
      const trialExpiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      updatePayload = {
        ...updatePayload,
        plan: "TRIAL",
        trial_used: true,
        trial_started_at: now.toISOString(),
        trial_expires_at: trialExpiresAt,
      };

      role = "TRIAL";
      expiresAt = trialExpiresAt;
      loginReason = "trial_started";
    } else if (trialActive) {
      role = "TRIAL";
      expiresAt = user.trial_expires_at;
      loginReason = "trial_login_success";
    } else if (proActive) {
      role = "PRO";
      expiresAt = user.pro_expires_at;
      loginReason = "pro_login_success";
    } else {
      return failLogin({
        status: 403,
        error: user.trial_used
          ? "Trial akun Telegram ini sudah pernah digunakan. Silakan upgrade ke PRO."
          : "Akses belum aktif",
        reason: user.trial_used ? "trial_already_used_or_expired" : "access_inactive",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    if (!expiresAt) {
      return failLogin({
        status: 403,
        error: "Masa aktif akun tidak valid",
        reason: "invalid_access_expiry",
        code: loginCode,
        ipHash,
        userAgentHash,
      });
    }

    const { error: userUpdateError } = await supabase
      .from("telegram_users")
      .update(updatePayload)
      .eq("id", user.id);

    if (userUpdateError) throw userUpdateError;

    const { error: codeUpdateError } = await supabase
      .from("telegram_login_codes")
      .update({ used_at: now.toISOString(), consumed_session_id: sessionId })
      .eq("id", loginCode.id);

    if (codeUpdateError) throw codeUpdateError;

    await writeAccessEvent({
      userId: user.id,
      telegramUserId: user.telegram_user_id,
      chatId: user.chat_id || loginCode.chat_id,
      eventType: loginReason === "trial_started" ? "TRIAL_STARTED" : "LOGIN_SUCCESS",
      eventDetail: loginReason,
      metadata: {
        code_type: loginCode.code_type,
        role,
        expires_at: expiresAt,
        session_id: sessionId,
        device_bound: true,
      },
      ipHash,
      userAgentHash,
    });

    const token = signToken(
      {
        role,
        accountId: user.id,
        sessionId,
      },
      secondsUntil(expiresAt),
    );

    return NextResponse.json({
      success: true,
      role,
      token,
      telegram_user_id: user.telegram_user_id,
      expires_at: expiresAt,
      session_id: sessionId,
      device_bound: true,
    });
  } catch (e) {
    console.error("CODE_LOGIN_ERROR", e);

    return NextResponse.json(
      { success: false, error: "Gagal login dengan kode Telegram" },
      { status: 500 },
    );
  }
}
