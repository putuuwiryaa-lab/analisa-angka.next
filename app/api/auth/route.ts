import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireEnv } from "@/lib/server/env";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { signToken, type Role } from "@/lib/server/jwt";
import { getClientIp } from "@/lib/server/http";

export const runtime = "nodejs";

const LIMIT = 5;
const WINDOW_MINUTES = 15;

function safeCompare(a: string, b: string) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hashValue(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

async function countFailedAttempts(
  supabase: ReturnType<typeof createAdminClient>,
  field: "ip_hash" | "device_id",
  value: string,
  sinceIso: string,
) {
  if (!value) return 0;
  const { count, error } = await supabase
    .from("pin_auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq(field, value)
    .eq("success", false)
    .gte("attempted_at", sinceIso);
  if (error) throw error;
  return count || 0;
}

async function logAttempt(
  supabase: ReturnType<typeof createAdminClient>,
  payload: {
    ip_hash: string;
    device_id: string;
    display_code: string;
    success: boolean;
    reason: string;
  },
) {
  const { error } = await supabase
    .from("pin_auth_attempts")
    .insert({ ...payload, attempted_at: new Date().toISOString() });
  if (error) console.error("PIN_ATTEMPT_LOG_ERROR", error);
}

export async function POST(request: Request) {
  let PIN_SECRET = "";
  let MASTER_PIN = "";

  try {
    PIN_SECRET = requireEnv("PIN_SECRET");
    MASTER_PIN = requireEnv("MASTER_PIN");
    requireEnv("JWT_SECRET");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.json(
      { success: false, error: "Kesalahan konfigurasi server" },
      { status: 500 },
    );
  }

  const supabase = createAdminClient();
  const body = await request.json().catch(() => ({}));
  const { pin, deviceId, displayCode } = body;

  const submittedPin = String(pin || "").trim();
  const deviceIdStr = String(deviceId || "").trim();
  const displayCodeStr = String(displayCode || "").trim();

  const ipHash = hashValue(getClientIp(request.headers), requireEnv("JWT_SECRET"));
  const sinceIso = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    const ipFailures = await countFailedAttempts(supabase, "ip_hash", ipHash, sinceIso);
    const deviceFailures = await countFailedAttempts(
      supabase,
      "device_id",
      deviceIdStr,
      sinceIso,
    );

    if (ipFailures >= LIMIT || deviceFailures >= LIMIT) {
      await logAttempt(supabase, {
        ip_hash: ipHash,
        device_id: deviceIdStr,
        display_code: displayCodeStr,
        success: false,
        reason: "rate_limited",
      });
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan. Coba lagi ${WINDOW_MINUTES} menit lagi.`,
        },
        { status: 429 },
      );
    }

    if (
      !deviceIdStr ||
      deviceIdStr.length < 20 ||
      !/^\d{6}$/.test(displayCodeStr) ||
      !/^\d{6}$/.test(submittedPin)
    ) {
      await logAttempt(supabase, {
        ip_hash: ipHash,
        device_id: deviceIdStr,
        display_code: displayCodeStr,
        success: false,
        reason: "invalid_payload",
      });
      return NextResponse.json({ success: false, error: "PIN SALAH!" }, { status: 401 });
    }

    const generateSecurePin = (id: string, rolePrefix: string) => {
      const hash = crypto
        .createHmac("sha256", PIN_SECRET)
        .update(id + rolePrefix)
        .digest("hex");
      const numericOnly = hash.replace(/\D/g, "");
      return numericOnly.substring(0, 6).padStart(6, "0");
    };

    const proPin = generateSecurePin(displayCodeStr, "PRO");

    let role: Role | null = null;
    if (safeCompare(submittedPin, MASTER_PIN)) {
      role = "MASTER";
    } else if (safeCompare(submittedPin, proPin)) {
      role = "PRO";
    }

    if (!role) {
      await logAttempt(supabase, {
        ip_hash: ipHash,
        device_id: deviceIdStr,
        display_code: displayCodeStr,
        success: false,
        reason: "wrong_pin",
      });
      const remaining = Math.max(0, LIMIT - Math.max(ipFailures, deviceFailures) - 1);
      return NextResponse.json(
        {
          success: false,
          error:
            remaining > 0
              ? `PIN SALAH! Sisa ${remaining} percobaan.`
              : "Akses diblokir 15 menit!",
        },
        { status: 401 },
      );
    }

    await logAttempt(supabase, {
      ip_hash: ipHash,
      device_id: deviceIdStr,
      display_code: displayCodeStr,
      success: true,
      reason: role,
    });

    const expiresIn = role === "PRO" ? "60d" : "365d";
    const token = signToken(
      { role, deviceId: deviceIdStr, displayCode: displayCodeStr },
      expiresIn,
    );

    return NextResponse.json({ success: true, role, token });
  } catch (e) {
    console.error("PIN_AUTH_ERROR", e);
    return NextResponse.json(
      { success: false, error: "Gagal memverifikasi PIN" },
      { status: 500 },
    );
  }
      }
        
