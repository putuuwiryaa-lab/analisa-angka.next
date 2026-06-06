import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Trial gratis sudah dinonaktifkan. Silakan aktivasi VIP." },
    { status: 403 },
  );
}
