import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anon client + RLS — sama seperti perilaku route lama (read-only markets publik).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .order("order", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat markets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
