import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/server/env";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { verifyToken, TOKEN_VERSION } from "@/lib/server/jwt";

export const runtime = "nodejs";

async function verifyTrialAccess(deviceId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("trial_activations_v2")
    .select("expires_at")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: "Gagal memeriksa trial" };
  if (!data?.expires_at) return { ok: false, status: 403, error: "Trial tidak ditemukan" };
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 403, error: "Trial sudah habis. Silakan aktivasi VIP." };
  }

  await supabase
    .from("trial_activations_v2")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("device_id", deviceId);

  return { ok: true as const };
}

export async function POST(request: Request) {
  try {
    requireEnv("JWT_SECRET");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.json(
      { valid: false, error: "Kesalahan konfigurasi server" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { token, deviceId } = body;

  if (!token || !deviceId) {
    return NextResponse.json(
      { valid: false, error: "Token atau perangkat tidak ditemukan" },
      { status: 401 },
    );
  }

  try {
    const decoded = verifyToken(token);
    const role = String(decoded.role || "");
    const decodedDeviceId = String(decoded.deviceId || "");

    if (decoded.tokenVersion !== TOKEN_VERSION) {
      return NextResponse.json(
        { valid: false, error: "Sesi lama. Silakan login ulang." },
        { status: 401 },
      );
    }

    if (!["TRIAL", "PRO", "MASTER"].includes(role)) {
      return NextResponse.json(
        { valid: false, error: "Akses tidak valid" },
        { status: 403 },
      );
    }

    if (!decodedDeviceId || decodedDeviceId !== String(deviceId)) {
      return NextResponse.json(
        { valid: false, error: "Token tidak cocok dengan perangkat" },
        { status: 401 },
      );
    }

    if (role === "TRIAL") {
      const trialAccess = await verifyTrialAccess(decodedDeviceId);
      if (!trialAccess.ok) {
        return NextResponse.json(
          { valid: false, error: trialAccess.error },
          { status: trialAccess.status },
        );
      }
    }

    return NextResponse.json({
      valid: true,
      role,
      displayCode: decoded.displayCode,
    });
  } catch (e) {
    const message =
      e instanceof Error && e.name === "TokenExpiredError"
        ? "Token sudah kadaluarsa"
        : "Token tidak valid";
    return NextResponse.json({ valid: false, error: message }, { status: 401 });
  }
}
