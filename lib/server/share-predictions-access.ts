import "server-only";
import { NextResponse } from "next/server";
import type { SessionAccess } from "@/lib/server/telegram-session";

const NO_STORE = { "Cache-Control": "no-store" };

export function requireSuperShareAccess(access: SessionAccess) {
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: NO_STORE },
    );
  }

  if (access.role !== "SUPER") {
    return NextResponse.json(
      { error: "Share Prediksi hanya tersedia untuk role SUPER." },
      { status: 403, headers: NO_STORE },
    );
  }

  return null;
}
