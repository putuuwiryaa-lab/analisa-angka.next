import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  await supabase.from("telegram_access_events").insert({
    user_id: data.id,
    telegram_user_id: user.id,
    chat_id: chatId,
    event_type: "START",
    event_detail: "Telegram user opened bot start command",
    metadata: {
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      language_code: user.language_code || null,
    },
  });

  return data;
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
}

function startMessage(user: TelegramUser, account: TelegramUserRow) {
  const telegramId = user.id ? String(user.id) : "tidak terbaca";
  const name = user.first_name || user.username || "teman teman";
  const plan = account.plan || "NONE";
  const accessUntil = plan === "PRO" ? account.pro_expires_at : account.trial_expires_at;

  return [
    `Selamat datang di <b>Analisa Angka</b>.`,
    "",
    `Nama Telegram: <b>${name}</b>`,
    `ID Telegram: <code>${telegramId}</code>`,
    `Status: <b>${plan}</b>`,
    `Trial pernah dipakai: <b>${account.trial_used ? "YA" : "BELUM"}</b>`,
    `Akses sampai: <b>${formatDate(accessUntil)}</b>`,
    "",
    "ID ini dipakai untuk mengikat akses Trial 7 hari atau PRO.",
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
      await sendTelegramMessage(chatId, startMessage(user, account));
      return NextResponse.json({ ok: true, handled: "start" });
    }

    await sendTelegramMessage(
      chatId,
      "Perintah belum tersedia. Ketik /start untuk melihat ID Telegram teman teman.",
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
