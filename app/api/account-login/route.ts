import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ success: false, error: "Belum aktif" }, { status: 501 });
}
