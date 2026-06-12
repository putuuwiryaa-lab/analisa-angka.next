import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { getBearerToken, verifyToken } from "@/lib/server/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUserRow = {
  id: string;
  telegram_user_id: number;
  plan: "NONE" | "TRIAL" | "PRO";
  trial_expires_at: string | null;
  pro_expires_at: string | null;
  is_active: boolean;
  suspended_at: string | null;
  active_session_id: string | null;
};

function isFutureDate(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Token tidak ditemukan" },
      { status: 401 },
    );
  }

  try {
    const payload = verifyToken(token);

    if (!payload.accountId || !payload.sessionId) {
      return NextResponse.json(
        { success: false, error: "Token tidak lengkap" },
        { status: 401 },
      );
    }

    const supabase = createAdminClient();

    const { data: user, error } = await supabase
      .from("telegram_users")
      .select(
        "id, telegram_user_id, plan, trial_expires_at, pro_expires_at, is_active, suspended_at, active_session_id",
      )
      .eq("id", payload.accountId)
      .maybeSingle<TelegramUserRow>();

    if (error) throw error;

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Akun tidak ditemukan" },
        { status: 401 },
      );
    }

    if (!user.is_active || user.suspended_at) {
      return NextResponse.json(
        { success: false, error: "Akun sedang tidak aktif" },
        { status: 403 },
      );
    }

    if (user.active_session_id !== payload.sessionId) {
      return NextResponse.json(
        { success: false, error: "Session sudah diganti perangkat lain" },
        { status: 401 },
      );
    }

    const role = payload.role;
    const expiresAt = role === "PRO" ? user.pro_expires_at : user.trial_expires_at;

    if (!isFutureDate(expiresAt)) {
      return NextResponse.json(
        { success: false, error: "Akses sudah kedaluwarsa" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      role,
      telegram_user_id: user.telegram_user_id,
      expires_at: expiresAt,
      session_id: payload.sessionId,
    });
  } catch (error) {
    console.error("VERIFY_SESSION_ERROR", error);

    return NextResponse.json(
      { success: false, error: "Session tidak valid" },
      { status: 401 },
    );
  }
}
