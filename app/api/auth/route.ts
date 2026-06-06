import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Login PIN sudah dinonaktifkan. Gunakan login VIP dengan nomor WhatsApp dan password.",
    },
    { status: 410 },
  );
}
