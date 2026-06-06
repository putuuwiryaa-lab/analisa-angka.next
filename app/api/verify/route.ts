import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/server/env";
import { verifyToken } from "@/lib/server/jwt";
import { verifyActiveVipSession } from "@/lib/server/vip-session";

export const runtime = "nodejs";

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
  const token = String(body.token || "");

  if (!token) {
    return NextResponse.json(
      { valid: false, error: "Token tidak ditemukan" },
      { status: 401 },
    );
  }

  try {
    const decoded = verifyToken(token);
    const headers = new Headers({ authorization: `Bearer ${token}` });
    const access = await verifyActiveVipSession(headers);

    if (!access.ok) {
      return NextResponse.json(
        { valid: false, error: access.error },
        { status: access.status },
      );
    }

    return NextResponse.json({
      valid: true,
      role: access.role,
      phone: decoded.phone || access.phone || null,
    });
  } catch (e) {
    const message =
      e instanceof Error && e.name === "TokenExpiredError"
        ? "Token sudah kadaluarsa"
        : "Token tidak valid";
    return NextResponse.json({ valid: false, error: message }, { status: 401 });
  }
}
