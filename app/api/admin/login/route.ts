import { NextResponse } from "next/server";
import { hashIp, isAdminPasswordValid, setAdminCookie } from "@/lib/server/access";
import { getClientIp } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

type LoginAttempt = {
  failures: number;
  resetAt: number;
  lockedUntil: number;
};

const loginAttempts = new Map<string, LoginAttempt>();

function attemptKey(headers: Headers) {
  return hashIp(getClientIp(headers));
}

function freshAttempt(now: number): LoginAttempt {
  return {
    failures: 0,
    resetAt: now + LOGIN_WINDOW_MS,
    lockedUntil: 0,
  };
}

function getAttempt(key: string, now: number) {
  const current = loginAttempts.get(key);

  if (!current) {
    const attempt = freshAttempt(now);
    loginAttempts.set(key, attempt);
    return attempt;
  }

  if (current.resetAt <= now && current.lockedUntil <= now) {
    const attempt = freshAttempt(now);
    loginAttempts.set(key, attempt);
    return attempt;
  }

  return current;
}

function retryAfterSeconds(lockedUntil: number, now: number) {
  return String(Math.max(1, Math.ceil((lockedUntil - now) / 1000)));
}

function blockedResponse(lockedUntil: number, now: number) {
  return NextResponse.json(
    { success: false, error: "Terlalu banyak percobaan login. Coba lagi beberapa menit." },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfterSeconds(lockedUntil, now),
      },
    },
  );
}

function recordFailedAttempt(key: string, now: number) {
  const attempt = getAttempt(key, now);
  attempt.failures += 1;

  if (attempt.failures >= MAX_FAILED_ATTEMPTS) {
    attempt.lockedUntil = now + LOGIN_LOCK_MS;
    attempt.resetAt = attempt.lockedUntil;
  }

  loginAttempts.set(key, attempt);
  return attempt;
}

export async function POST(request: Request) {
  const key = attemptKey(request.headers);
  const now = Date.now();
  const attempt = getAttempt(key, now);

  if (attempt.lockedUntil > now) {
    return blockedResponse(attempt.lockedUntil, now);
  }

  const body = await request.json().catch(() => ({}));
  const input = String(body.password || "");

  if (!isAdminPasswordValid(input)) {
    const failedAttempt = recordFailedAttempt(key, now);

    if (failedAttempt.lockedUntil > now) {
      return blockedResponse(failedAttempt.lockedUntil, now);
    }

    return NextResponse.json({ success: false, error: "Login admin gagal." }, { status: 401 });
  }

  loginAttempts.delete(key);

  const response = NextResponse.json({ success: true });
  setAdminCookie(response);
  return response;
}
