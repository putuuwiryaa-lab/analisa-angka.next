import { NextResponse } from "next/server";

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

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum diatur");
  return token;
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

function startMessage(user: TelegramUser) {
  const telegramId = user.id ? String(user.id) : "tidak terbaca";
  const name = user.first_name || user.username || "teman teman";

  return [
    `Selamat datang di <b>Analisa Angka</b>.`,
    "",
    `Nama Telegram: <b>${name}</b>`,
    `ID Telegram: <code>${telegramId}</code>`,
    "",
    "ID ini nanti dipakai untuk mengikat akses Trial 7 hari atau PRO.",
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
      await sendTelegramMessage(chatId, startMessage(user));
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
