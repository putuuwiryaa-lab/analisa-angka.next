import { NextResponse } from "next/server";
import { isAdminPasswordValid, setAdminCookie } from "@/lib/server/access";
import {
  checkRateLimit,
  clearRateLimit,
  rateLimitKey,
  rateLimitResponse,
  recordRateLimitFailure,
  type RateLimitConfig,
} from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

function loginRateLimit(headers: Headers): RateLimitConfig {
  return {
    key: rateLimitKey("admin_login", headers),
    maxAttempts: MAX_FAILED_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
    lockMs: LOGIN_LOCK_MS,
    error: "Terlalu banyak percobaan login. Coba lagi beberapa menit.",
  };
}

export async function POST(request: Request) {
  const limit = loginRateLimit(request.headers);
  const currentLimit = await checkRateLimit(limit);
  if (!currentLimit.ok) return rateLimitResponse(currentLimit);

  const body = await request.json().catch(() => ({}));
  const input = String(body.password || "");

  if (!isAdminPasswordValid(input)) {
    const failedLimit = await recordRateLimitFailure(limit);
    if (!failedLimit.ok) return rateLimitResponse(failedLimit);

    return NextResponse.json({ success: false, error: "Login admin gagal." }, { status: 401 });
  }

  await clearRateLimit(limit.key);

  const response = NextResponse.json({ success: true });
  setAdminCookie(response);
  return response;
}
