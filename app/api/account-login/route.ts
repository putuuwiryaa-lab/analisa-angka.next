import { NextResponse } from "next/server";
import { emailFromPhone, normalizePhone, phoneIsValid } from "@/lib/auth/accountLogin";
import { requireEnv } from "@/lib/server/env";

export const runtime = "nodejs";

async function checkCredentials(phone: string, passcode: string) {
  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Konfigurasi Supabase Auth belum lengkap");

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: emailFromPhone(phone), password: passcode }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.user?.id) return null;
  return String(json.user.id);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const passcode = String(body.password || "").trim();
  const deviceId = String(body.deviceId || "").trim();
  const displayCode = String(body.displayCode || "").trim();

  if (!phoneIsValid(phone) || passcode.length < 4) {
    return NextResponse.json({ success: false, error: "Nomor WA atau password tidak valid" }, { status: 400 });
  }
  if (!deviceId || deviceId.length < 20 || !/^\d{6}$/.test(displayCode)) {
    return NextResponse.json({ success: false, error: "Identitas perangkat tidak valid" }, { status: 400 });
  }

  try {
    const userId = await checkCredentials(phone, passcode);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Nomor WA atau password salah" }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: "Profile VIP belum diverifikasi" }, { status: 501 });
  } catch (e) {
    console.error("ACCOUNT_LOGIN_ERROR", e);
    return NextResponse.json({ success: false, error: "Gagal login akun VIP" }, { status: 500 });
  }
}
