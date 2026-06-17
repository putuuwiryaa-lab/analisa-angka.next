import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomInt } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUser = {
  id?: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

type TelegramChat = {
  id?: number;
  type?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramMessage = {
  message_id?: number;
  from?: TelegramUser;
  chat?: TelegramChat;
  text?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
};

type TelegramUserRow = {
  id: string;
  telegram_user_id: number;
  plan: "NONE" | "TRIAL" | "PRO";
  trial_used: boolean;
  trial_expires_at: string | null;
  pro_expires_at: string | null;
};

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum diatur");
  return token;
}

function getCodeSecret() {
  const secret = process.env.TELEGRAM_LOGIN_CODE_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) throw new Error("TELEGRAM_LOGIN_CODE_SECRET atau TELEGRAM_WEBHOOK_SECRET belum diatur");
  return secret;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum diatur");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diatur");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isValidWebhookSecret(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;

  const submitted = request.headers.get("x-telegram-bot-api-secret-token") || "";
  return submitted === expected;
}

function isFutureDate(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function generateLoginCode() {
  return String(randomInt(100000, 1000000));
}

function hashLoginCode(code: string) {
  return createHash("sha256").update(`${getCodeSecret()}:${code}`).digest("hex");
}

function escapeTelegramHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveCodeType(account: TelegramUserRow) {
  if (account.plan === "PRO" && isFutureDate(account.pro_expires_at)) return "PRO_LOGIN";
  if (!account.trial_used) return "TRIAL_LOGIN";
  return "LOGIN";
}

function canCreateLoginCode(account: TelegramUserRow) {
  const proActive = account.plan === "PRO" && isFutureDate(account.pro_expires_at);
  const trialActive = account.plan === "TRIAL" && isFutureDate(account.trial_expires_at);

  if (proActive || trialActive || !account.trial_used) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    reason: "trial_expired_without_pro",
    message: [
      "Trial akun ini sudah pernah digunakan dan masa aktifnya sudah habis.",
      "",
      "Kode login baru tidak dibuat.",
      "Silakan upgrade ke PRO untuk melanjutkan akses.",
    ].join("\n"),
  };
}

async function sendTelegramMessage(chatId: number, text: string) {
  const token = getBotToken();

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gagal mengirim pesan Telegram: ${detail}`);
  }
}

async function upsertTelegramUser(user: TelegramUser, chatId: number) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("telegram_users")
    .upsert(
      {
        telegram_user_id: user.id,
        chat_id: chatId,
        telegram_username: user.username || null,
        telegram_first_name: user.first_name || null,
        telegram_last_name: user.last_name || null,
        telegram_language_code: user.language_code || null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" },
    )
    .select("id, telegram_user_id, plan, trial_used, trial_expires_at, pro_expires_at")
    .single<TelegramUserRow>();

  if (error) throw error;
  return data;
}

async function recordAccessEvent(params: {
  userId?: string;
  telegramUserId?: number;
  chatId?: number;
  eventType: string;
  eventDetail?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("telegram_access_events").insert({
    user_id: params.userId || null,
    telegram_user_id: params.telegramUserId || null,
    chat_id: params.chatId || null,
    event_type: params.eventType,
    event_detail: params.eventDetail || null,
    metadata: params.metadata || {},
  });

  if (error) throw error;
}

async function createLoginCode(account: TelegramUserRow, chatId: number) {
  const supabase = getSupabaseAdmin();
  const code = generateLoginCode();
  const codeHash = hashLoginCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const codeType = resolveCodeType(account);

  await supabase
    .from("telegram_login_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("telegram_user_id", account.telegram_user_id)
    .is("used_at", null);

  const { error } = await supabase.from("telegram_login_codes").insert({
    user_id: account.id,
    telegram_user_id: account.telegram_user_id,
    chat_id: chatId,
    code_hash: codeHash,
    code_type: codeType,
    expires_at: expiresAt,
  });

  if (error) throw error;

  await recordAccessEvent({
    userId: account.id,
    telegramUserId: account.telegram_user_id,
    chatId,
    eventType: "REQUEST_CODE",
    eventDetail: "Telegram user requested a login code",
    metadata: { code_type: codeType, expires_at: expiresAt },
  });

  return { code, codeType };
}

function startMessage(user: TelegramUser, account: TelegramUserRow) {
  const telegramId = escapeTelegramHtml(user.id ? String(user.id) : "tidak terbaca");
  const name = escapeTelegramHtml(user.first_name || user.username || "teman teman");
  const plan = escapeTelegramHtml(account.plan || "NONE");
  const trialUsed = escapeTelegramHtml(account.trial_used ? "YA" : "BELUM");

  return [
    `Selamat datang di <b>Analisa Angka</b>.`,
    "",
    `Nama Telegram: <b>${name}</b>`,
    `ID Telegram: <code>${telegramId}</code>`,
    `Status: <b>${plan}</b>`,
    `Trial pernah dipakai: <b>${trialUsed}</b>`,
    "",
    "Ketik /kode untuk membuat kode login.",
  ].join("\n");
}

function codeMessage(params: { code: string; codeType: string }) {
  const label = params.codeType === "TRIAL_LOGIN" ? "TRIAL" : params.codeType === "PRO_LOGIN" ? "PRO" : "LOGIN";
  const safeLabel = escapeTelegramHtml(label);
  const safeCode = escapeTelegramHtml(params.code);

  return [
    `Kode login <b>${safeLabel}</b>:`,
    "",
    `<code>${safeCode}</code>`,
    "",
    "Masukkan kode ini di halaman login Analisa Angka.",
    "Kode lama otomatis dinonaktifkan.",
  ].join("\n");
}

export async function POST(request: Request) {
  if (!isValidWebhookSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || "").trim();
    const user = message?.from;

    if (!chatId || !user?.id) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (text === "/start" || text.startsWith("/start ")) {
      const account = await upsertTelegramUser(user, chatId);

      await recordAccessEvent({
        userId: account.id,
        telegramUserId: user.id,
        chatId,
        eventType: "START",
        eventDetail: "Telegram user opened bot start command",
        metadata: {
          username: user.username || null,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          language_code: user.language_code || null,
        },
      });

      await sendTelegramMessage(chatId, startMessage(user, account));
      return NextResponse.json({ ok: true, handled: "start" });
    }

    if (text === "/kode" || text.startsWith("/kode ")) {
      const account = await upsertTelegramUser(user, chatId);
      const gate = canCreateLoginCode(account);

      if (!gate.ok) {
        await recordAccessEvent({
          userId: account.id,
          telegramUserId: account.telegram_user_id,
          chatId,
          eventType: "REQUEST_CODE_DENIED",
          eventDetail: gate.reason,
          metadata: {
            plan: account.plan,
            trial_used: account.trial_used,
            trial_expires_at: account.trial_expires_at,
            pro_expires_at: account.pro_expires_at,
          },
        });

        await sendTelegramMessage(chatId, gate.message);
        return NextResponse.json({ ok: true, handled: "kode_denied" });
      }

      const loginCode = await createLoginCode(account, chatId);

      await sendTelegramMessage(chatId, codeMessage(loginCode));
      return NextResponse.json({ ok: true, handled: "kode" });
    }

    await sendTelegramMessage(
      chatId,
      "Perintah belum tersedia. Ketik /start untuk melihat ID Telegram atau /kode untuk membuat kode login.",
    );

    return NextResponse.json({ ok: true, handled: "fallback" });
  } catch (error) {
    console.error("TELEGRAM_WEBHOOK_ERROR", error);

    return NextResponse.json(
      { ok: false, error: "Gagal memproses webhook Telegram" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "telegram-webhook",
  });
}
