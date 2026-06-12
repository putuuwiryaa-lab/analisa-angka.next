import { NextResponse } from "next/server";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await verifyActiveTelegramSession(request.headers);

  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status },
    );
  }

  return NextResponse.json({
    success: true,
    role: access.role,
    telegram_user_id: access.telegramUserId,
    expires_at: access.expiresAt,
    session_id: access.sessionId,
    device_bound: access.deviceBound,
  });
}
