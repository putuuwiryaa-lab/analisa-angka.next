import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "./supabase-admin";
import { hashIp } from "./access";
import { getClientIp } from "./http";

export const RATE_LIMITS_TABLE = "analisa_rate_limits";
const RATE_LIMIT_FAILURE_RPC = "record_rate_limit_failure";

type RateLimitRow = {
  rate_key: string;
  failures: number;
  reset_at: string;
  locked_until: string | null;
};

type RateLimitFailureRow = {
  failures: number;
  reset_at: string;
  locked_until: string | null;
  is_locked: boolean;
};

type MemoryAttempt = {
  failures: number;
  resetAt: number;
  lockedUntil: number;
};

export type RateLimitConfig = {
  key: string;
  maxAttempts: number;
  windowMs: number;
  lockMs: number;
  error: string;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; status: 429; error: string; retryAfter: number };

const memoryAttempts = new Map<string, MemoryAttempt>();

export function rateLimitKey(scope: string, headers: Headers) {
  return `${scope}:${hashIp(getClientIp(headers))}`;
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return NextResponse.json(
    { success: false, error: result.error },
    { status: result.status, headers: { "Retry-After": String(result.retryAfter) } },
  );
}

function retryAfter(lockedUntil: number, now: number) {
  return Math.max(1, Math.ceil((lockedUntil - now) / 1000));
}

function blocked(config: RateLimitConfig, lockedUntil: number, now: number): RateLimitResult {
  return { ok: false, status: 429, error: config.error, retryAfter: retryAfter(lockedUntil, now) };
}

function freshMemoryAttempt(now: number, config: RateLimitConfig): MemoryAttempt {
  return { failures: 0, resetAt: now + config.windowMs, lockedUntil: 0 };
}

function getMemoryAttempt(config: RateLimitConfig, now: number) {
  const current = memoryAttempts.get(config.key);
  if (!current || (current.resetAt <= now && current.lockedUntil <= now)) {
    const attempt = freshMemoryAttempt(now, config);
    memoryAttempts.set(config.key, attempt);
    return attempt;
  }
  return current;
}

function checkMemoryRateLimit(config: RateLimitConfig, now = Date.now()): RateLimitResult {
  const attempt = getMemoryAttempt(config, now);
  if (attempt.lockedUntil > now) return blocked(config, attempt.lockedUntil, now);
  return { ok: true };
}

function recordMemoryFailure(config: RateLimitConfig, now = Date.now()): RateLimitResult {
  const attempt = getMemoryAttempt(config, now);
  attempt.failures += 1;

  if (attempt.failures >= config.maxAttempts) {
    attempt.lockedUntil = now + config.lockMs;
    attempt.resetAt = attempt.lockedUntil;
  }

  memoryAttempts.set(config.key, attempt);
  if (attempt.lockedUntil > now) return blocked(config, attempt.lockedUntil, now);
  return { ok: true };
}

function clearMemoryRateLimit(key: string) {
  memoryAttempts.delete(key);
}

function isRecoverableRateLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code || "") : "";
  const message = "message" in error ? String(error.message || "") : "";
  return (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" ||
    message.toLowerCase().includes(RATE_LIMITS_TABLE) ||
    message.toLowerCase().includes(RATE_LIMIT_FAILURE_RPC)
  );
}

function rowIsLocked(row: { locked_until: string | null } | null, now: number) {
  if (!row?.locked_until) return 0;
  const lockedUntil = new Date(row.locked_until).getTime();
  return lockedUntil > now ? lockedUntil : 0;
}

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(RATE_LIMITS_TABLE)
      .select("rate_key,failures,reset_at,locked_until")
      .eq("rate_key", config.key)
      .maybeSingle<RateLimitRow>();

    if (error) throw error;

    const lockedUntil = rowIsLocked(data, now);
    if (lockedUntil) return blocked(config, lockedUntil, now);
    return { ok: true };
  } catch (error) {
    if (!isRecoverableRateLimitError(error)) console.error("RATE_LIMIT_CHECK_ERROR", error);
    return checkMemoryRateLimit(config, now);
  }
}

export async function recordRateLimitFailure(config: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(RATE_LIMIT_FAILURE_RPC, {
      p_rate_key: config.key,
      p_max_attempts: config.maxAttempts,
      p_window_ms: config.windowMs,
      p_lock_ms: config.lockMs,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? (data[0] as RateLimitFailureRow | undefined) : undefined;
    if (!row) throw new Error("RPC rate limit tidak mengembalikan hasil.");

    const lockedUntil = rowIsLocked(row, now);
    if (row.is_locked && lockedUntil) return blocked(config, lockedUntil, now);
    return { ok: true };
  } catch (error) {
    if (!isRecoverableRateLimitError(error)) console.error("RATE_LIMIT_RECORD_ERROR", error);
    return recordMemoryFailure(config, now);
  }
}

export async function clearRateLimit(key: string) {
  clearMemoryRateLimit(key);

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(RATE_LIMITS_TABLE).delete().eq("rate_key", key);
    if (error) throw error;
  } catch (error) {
    if (!isRecoverableRateLimitError(error)) console.error("RATE_LIMIT_CLEAR_ERROR", error);
  }
}
