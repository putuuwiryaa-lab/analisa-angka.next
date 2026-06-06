import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/server/env";
import { verifyToken, TOKEN_VERSION } from "@/lib/server/jwt";

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
  const { token } = body;

  if (!token) {
    return NextResponse.json(
      { valid: false, error: "Token tidak ditemukan" },
      { status: 401 },
    );
  }

  try {
    const decoded = verifyToken(token);
    const role = String(decoded.role || "");

    if (decoded.tokenVersion !== TOKEN_VERSION) {
      return NextResponse.json(
        { valid: false, error: "Sesi lama. Silakan login ulang." },
        { status: 401 },
      );
    }

    if (!["PRO", "MASTER"].includes(role)) {
      return NextResponse.json(
        { valid: false, error: "Akses tidak valid" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      valid: true,
      role,
      phone: decoded.phone || null,
    });
  } catch (e) {
    const message =
      e instanceof Error && e.name === "TokenExpiredError"
        ? "Token sudah kadaluarsa"
        : "Token tidak valid";
    return NextResponse.json({ valid: false, error: message }, { status: 401 });
  }
}
