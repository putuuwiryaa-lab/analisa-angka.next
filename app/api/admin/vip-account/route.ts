import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireEnv } from "@/lib/server/env";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

type VipRole = "PRO" | "MASTER";

function normalizePhone(input: unknown) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function emailFromPhone(phone: string) {
  return `${phone}@vip.local`;
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function expiryFromDays(days: number) {
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() + Math.floor(days) * 24 * 60 * 60 * 1000).toISOString();
}

function assertAdminSecret(request: Request) {
  const expected = requireEnv("ADMIN_API_SECRET");
  const submitted = request.headers.get("x-admin-secret") || "";
  return Boolean(expected && submitted && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(submitted)));
}

export async function POST(request: Request) {
  try {
    requireEnv("SUPABASE_URL");
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    requireEnv("ADMIN_API_SECRET");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: "Kesalahan konfigurasi server" }, { status: 500 });
  }

  try {
    if (!assertAdminSecret(request)) {
      return NextResponse.json({ success: false, error: "Akses admin tidak valid" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(body.phone);
    const role = String(body.role || "PRO").toUpperCase() as VipRole;
    const days = Number(body.days || 30);
    const password = generatePassword();
    const email = emailFromPhone(phone);
    const expiresAt = expiryFromDays(days);

    if (!/^62\d{8,15}$/.test(phone)) {
      return NextResponse.json({ success: false, error: "Nomor WhatsApp tidak valid" }, { status: 400 });
    }
    if (!["PRO", "MASTER"].includes(role)) {
      return NextResponse.json({ success: false, error: "Role tidak valid" }, { status: 400 });
    }
    if (!expiresAt && role !== "MASTER") {
      return NextResponse.json({ success: false, error: "Durasi tidak valid" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("vip_profiles")
      .select("user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfileError) throw existingProfileError;

    let userId = existingProfile?.user_id as string | undefined;

    if (userId) {
      const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
        email,
        password,
        email_confirm: true,
        user_metadata: { phone, role },
      });
      if (updateUserError) throw updateUserError;
    } else {
      const { data: created, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { phone, role },
      });
      if (createUserError) throw createUserError;
      userId = created.user?.id;
    }

    if (!userId) throw new Error("Gagal membuat user Supabase Auth");

    const { error: profileError } = await supabase
      .from("vip_profiles")
      .upsert(
        {
          user_id: userId,
          phone,
          role,
          expires_at: role === "MASTER" ? null : expiresAt,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (profileError) throw profileError;

    return NextResponse.json({
      success: true,
      phone,
      email,
      password,
      role,
      expires_at: role === "MASTER" ? null : expiresAt,
    });
  } catch (e) {
    console.error("ADMIN_VIP_ACCOUNT_ERROR", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Gagal membuat akun VIP" },
      { status: 500 },
    );
  }
}
