import { NextResponse } from "next/server";
import crypto from "crypto";
import { emailFromPhone, normalizePhone, phoneIsValid } from "@/lib/auth/accountLogin";
import { verifyVipProfile } from "@/lib/auth/vipProfile";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireEnv } from "@/lib/server/env";
import { signToken, type Role } from "@/lib/server/jwt";
import { getClientIp } from "@/lib/server/http";

export const runtime = "nodejs";

const SWITCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const PENALTY_MS = 24 * 60 * 60 * 1000;
const MAX_SWITCHES_PER_WINDOW = 3;

const PENALTY_MESSAGE =
  "Akun VIP dikunci sementara karena terdeteksi digunakan bergantian di beberapa perangkat. Silakan coba lagi setelah 24 jam.";

function hashValue(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function isPenaltyActive(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function formatPenaltyUntil(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return value;
  }
}

function calculateSwitchState(profile: any) {
  const hasExistingSession = Boolean(profile?.active_session_id);
  if (!hasExistingSession) {
    return {
      nextSwitchCount: 0,
      windowStart: profile?.session_switch_window_start || null,
      shouldPenalty: false,
    };
  }

  const now = Date.now();
  const windowStartMs = profile?.session_switch_window_start
    ? new Date(profile.session_switch_window_start).getTime()
    : 0;

  const windowExpired = !windowStartMs || now - windowStartMs > SWITCH_WINDOW_MS;
  const nextSwitchCount = windowExpired
    ? 1
    : Number(profile?.session_switch_count || 0) + 1;

  return {
    nextSwitchCount,
    windowStart: windowExpired
      ? new Date().toISOString()
      : profile.session_switch_window_start,
    shouldPenalty: nextSwitchCount > MAX_SWITCHES_PER_WINDOW,
  };
}

async function checkCredentials(phone: string, passcode: string) {
  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error("Konfigurasi Supabase Auth belum lengkap");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: emailFromPhone(phone),
      password: passcode,
    }),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json?.user?.id) {
    return null;
  }

  return String(json.user.id);
}

async function writeLoginEvent({
  userId,
  phone,
  ipHash,
  userAgentHash,
  success,
  reason,
}: {
  userId?: string;
  phone: string;
  ipHash: string;
  userAgentHash: string;
  success: boolean;
  reason: string;
}) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("vip_login_events").insert({
    user_id: userId || null,
    phone,
    ip_hash: ipHash,
    user_agent_hash: userAgentHash,
    success,
    reason,
  });

  if (error) {
    console.error("VIP_LOGIN_EVENT_ERROR", error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const phone = normalizePhone(body.phone);
  const passcode = String(body.password || "").trim();

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
  const userAgentHash = hashValue(
    request.headers.get("user-agent") || "unknown",
    jwtSecret,
  );

  if (!phoneIsValid(phone) || passcode.length < 4) {
    return NextResponse.json(
      { success: false, error: "Nomor WA atau password tidak valid" },
      { status: 400 },
    );
  }

  try {
    const userId = await checkCredentials(phone, passcode);

    if (!userId) {
      await writeLoginEvent({
        phone,
        ipHash,
        userAgentHash,
        success: false,
        reason: "wrong_credentials",
      });

      return NextResponse.json(
        { success: false, error: "Nomor WA atau password salah" },
        { status: 401 },
      );
    }

    const access = await verifyVipProfile(userId, phone);

    if (!access.ok) {
      await writeLoginEvent({
        userId,
        phone,
        ipHash,
        userAgentHash,
        success: false,
        reason: access.error,
      });

      return NextResponse.json(
        { success: false, error: access.error },
        { status: 403 },
      );
    }

    const profile: any = access.profile;

    if (isPenaltyActive(profile.penalty_until)) {
      await writeLoginEvent({
        userId,
        phone,
        ipHash,
        userAgentHash,
        success: false,
        reason: "penalty_active",
      });

      return NextResponse.json(
        {
          success: false,
          error: PENALTY_MESSAGE,
          penalty_until: formatPenaltyUntil(profile.penalty_until),
        },
        { status: 423 },
      );
    }

    const role = String(profile.role || "PRO") as Role;

    if (!["PRO", "MASTER"].includes(role)) {
      await writeLoginEvent({
        userId,
        phone,
        ipHash,
        userAgentHash,
        success: false,
        reason: "invalid_role",
      });

      return NextResponse.json(
        { success: false, error: "Role VIP tidak valid" },
        { status: 403 },
      );
    }

    const switchState = calculateSwitchState(profile);
    const supabase = createAdminClient();

    if (switchState.shouldPenalty) {
      const penaltyUntil = new Date(Date.now() + PENALTY_MS).toISOString();

      const { error: penaltyError } = await supabase
        .from("vip_profiles")
        .update({
          penalty_until: penaltyUntil,
          penalty_reason: "Terdeteksi login berpindah sesi terlalu sering dalam 24 jam",
          session_switch_count: switchState.nextSwitchCount,
          session_switch_window_start: switchState.windowStart,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (penaltyError) {
        throw penaltyError;
      }

      await writeLoginEvent({
        userId,
        phone,
        ipHash,
        userAgentHash,
        success: false,
        reason: "penalty_created",
      });

      return NextResponse.json(
        {
          success: false,
          error: PENALTY_MESSAGE,
          penalty_until: penaltyUntil,
        },
        { status: 423 },
      );
    }

    const sessionId = crypto.randomUUID();

    const { error: sessionError } = await supabase
      .from("vip_profiles")
      .update({
        active_session_id: sessionId,
        active_session_at: new Date().toISOString(),
        last_login_ip_hash: ipHash,
        last_login_user_agent_hash: userAgentHash,
        session_switch_count: switchState.nextSwitchCount,
        session_switch_window_start: switchState.windowStart,
        penalty_until: null,
        penalty_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (sessionError) {
      throw sessionError;
    }

    await writeLoginEvent({
      userId,
      phone,
      ipHash,
      userAgentHash,
      success: true,
      reason: switchState.nextSwitchCount > 0 ? "session_switched" : "login_success",
    });

    const token = signToken(
      {
        role,
        accountId: userId,
        phone,
        sessionId,
      },
      role === "MASTER" ? "365d" : "60d",
    );

    return NextResponse.json({
      success: true,
      role,
      token,
      phone,
      expires_at: profile.expires_at,
      session_switch_count: switchState.nextSwitchCount,
    });
  } catch (e) {
    console.error("ACCOUNT_LOGIN_ERROR", e);

    return NextResponse.json(
      { success: false, error: "Gagal login akun VIP" },
      { status: 500 },
    );
  }
}
