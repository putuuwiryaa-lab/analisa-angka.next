import { NextResponse } from "next/server";
import { normalizePhone, phoneIsValid } from "@/lib/auth/accountLogin";

export const runtime = "nodejs";

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

  return NextResponse.json({ success: false, error: "Login akun belum aktif" }, { status: 501 });
}
