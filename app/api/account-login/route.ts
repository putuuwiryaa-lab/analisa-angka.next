import { NextResponse } from "next/server";
import crypto from "crypto";
import { emailFromPhone, normalizePhone, phoneIsValid } from "@/lib/auth/accountLogin";
import { verifyVipProfile } from "@/lib/auth/vipProfile";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireEnv } from "@/lib/server/env";
import { signToken, type Role } from "@/lib/server/jwt";
import { getClientIp } from "@/lib/server/http";

export const runtime = "nodejs";

function hashValue(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
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

    const role = String(access.profile.role || "PRO") as Role;

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

    const sessionId = crypto.randomUUID();
    const supabase = createAdminClient();

    const { error: sessionError } = await supabase
      .from("vip_profiles")
      .update({
        active_session_id: sessionId,
        active_session_at: new Date().toISOString(),
        last_login_ip_hash: ipHash,
        last_login_user_agent_hash: userAgentHash,
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
      reason: "login_success",
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
      expires_at: access.profile.expires_at,
    });
  } catch (e) {
    console.error("ACCOUNT_LOGIN_ERROR", e);

    return NextResponse.json(
      { success: false, error: "Gagal login akun VIP" },
      { status: 500 },
    );
  }
}
