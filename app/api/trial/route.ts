import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireEnv } from "@/lib/server/env";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { signToken } from "@/lib/server/jwt";
import { getClientIp } from "@/lib/server/http";

export const runtime = "nodejs";

const TRIAL_DAYS = 14;
const MAX_TRIALS_PER_IP_24H = 2;
const MAX_TRIALS_PER_IP_LIFETIME = 5;
const TRIAL_USED_MESSAGE =
  "Trial gratis di perangkat ini sudah pernah digunakan. Silakan aktivasi VIP.";

function hashValue(value: string) {
  return crypto
    .createHmac("sha256", requireEnv("JWT_SECRET"))
    .update(value)
    .digest("hex");
}

function stableStringify(input: unknown) {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const clean = Object.keys(source)
    .sort()
    .reduce((acc: Record<string, string>, key) => {
      acc[key] = String(source[key] ?? "").slice(0, 240);
      return acc;
    }, {});
  return JSON.stringify(clean);
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

function remainingSecondsFrom(expiresAt: Date) {
  return Math.floor((expiresAt.getTime() - Date.now()) / 1000);
}

function buildToken(deviceId: string, displayCode: string, remainingSeconds: number) {
  return signToken({ role: "TRIAL", deviceId, displayCode }, remainingSeconds);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const deviceId = String(body?.deviceId || "").trim();
  const displayCode = String(body?.displayCode || "").trim();
  const fingerprintPayload = stableStringify(body?.fingerprint);

  if (!deviceId || deviceId.length < 20) {
    return NextResponse.json(
      { success: false, error: "Device ID tidak valid" },
      { status: 400 },
    );
  }

  if (!/^\d{6}$/.test(displayCode)) {
    return NextResponse.json(
      { success: false, error: "Display code tidak valid" },
      { status: 400 },
    );
  }

  if (fingerprintPayload === "{}") {
    return NextResponse.json(
      {
        success: false,
        error: "Perangkat tidak bisa diverifikasi. Gunakan browser utama perangkat ini.",
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const ipHash = hashValue(getClientIp(request.headers));
  const userAgent = String(request.headers.get("user-agent") || "");
  const userAgentHash = hashValue(userAgent);
  const fingerprintHash = hashValue(fingerprintPayload);

  const okResponse = (expiresAt: Date) =>
    NextResponse.json({
      success: true,
      role: "TRIAL",
      token: buildToken(deviceId, displayCode, remainingSecondsFrom(expiresAt)),
      expiresAt: expiresAt.toISOString(),
    });

  try {
    const { data: existingByDevice, error: deviceError } = await supabase
      .from("trial_activations_v2")
      .select("id, activated_at, expires_at, fingerprint_hash, user_agent_hash")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (deviceError) throw deviceError;

    if (existingByDevice?.expires_at) {
      if (isExpired(existingByDevice.expires_at)) {
        await supabase
          .from("trial_activations_v2")
          .update({ last_seen_at: now.toISOString(), trial_block_reason: "device_expired" })
          .eq("id", existingByDevice.id);
        return NextResponse.json(
          { success: false, expired: true, error: TRIAL_USED_MESSAGE },
          { status: 403 },
        );
      }
      await supabase
        .from("trial_activations_v2")
        .update({
          display_code: displayCode,
          fingerprint_hash: existingByDevice.fingerprint_hash || fingerprintHash,
          user_agent_hash: existingByDevice.user_agent_hash || userAgentHash,
          user_agent: userAgent,
          ip_hash: ipHash,
          last_seen_at: now.toISOString(),
        })
        .eq("id", existingByDevice.id);
      return okResponse(new Date(existingByDevice.expires_at));
    }

    const { data: existingByFingerprint, error: fingerprintError } = await supabase
      .from("trial_activations_v2")
      .select("id, activated_at, expires_at")
      .eq("fingerprint_hash", fingerprintHash)
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fingerprintError) throw fingerprintError;

    if (existingByFingerprint?.expires_at) {
      if (isExpired(existingByFingerprint.expires_at)) {
        await supabase
          .from("trial_activations_v2")
          .update({ last_seen_at: now.toISOString(), trial_block_reason: "fingerprint_expired" })
          .eq("id", existingByFingerprint.id);
        return NextResponse.json(
          { success: false, expired: true, error: TRIAL_USED_MESSAGE },
          { status: 403 },
        );
      }
      await supabase
        .from("trial_activations_v2")
        .update({
          device_id: deviceId,
          display_code: displayCode,
          user_agent_hash: userAgentHash,
          user_agent: userAgent,
          ip_hash: ipHash,
          last_seen_at: now.toISOString(),
        })
        .eq("id", existingByFingerprint.id);
      return okResponse(new Date(existingByFingerprint.expires_at));
    }

    const { data: existingByNetworkBrowser, error: networkBrowserError } = await supabase
      .from("trial_activations_v2")
      .select("id, activated_at, expires_at")
      .eq("ip_hash", ipHash)
      .eq("user_agent_hash", userAgentHash)
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (networkBrowserError) throw networkBrowserError;

    if (existingByNetworkBrowser?.expires_at) {
      if (isExpired(existingByNetworkBrowser.expires_at)) {
        await supabase
          .from("trial_activations_v2")
          .update({
            last_seen_at: now.toISOString(),
            trial_block_reason: "network_browser_expired",
          })
          .eq("id", existingByNetworkBrowser.id);
        return NextResponse.json(
          { success: false, expired: true, error: TRIAL_USED_MESSAGE },
          { status: 403 },
        );
      }
      await supabase
        .from("trial_activations_v2")
        .update({
          device_id: deviceId,
          display_code: displayCode,
          fingerprint_hash: fingerprintHash,
          last_seen_at: now.toISOString(),
        })
        .eq("id", existingByNetworkBrowser.id);
      return okResponse(new Date(existingByNetworkBrowser.expires_at));
    }

    const { count: trials24hCount, error: c24hErr } = await supabase
      .from("trial_activations_v2")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("activated_at", since24h);
    if (c24hErr) throw c24hErr;

    if ((trials24hCount || 0) >= MAX_TRIALS_PER_IP_24H) {
      return NextResponse.json(
        {
          success: false,
          error: "Batas trial gratis dari jaringan ini sudah tercapai. Silakan aktivasi VIP.",
        },
        { status: 403 },
      );
    }

    const { count: trialsLifetimeCount, error: cLifeErr } = await supabase
      .from("trial_activations_v2")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);
    if (cLifeErr) throw cLifeErr;

    if ((trialsLifetimeCount || 0) >= MAX_TRIALS_PER_IP_LIFETIME) {
      return NextResponse.json(
        {
          success: false,
          error: "Trial gratis di jaringan ini sudah mencapai batas. Silakan aktivasi VIP.",
        },
        { status: 403 },
      );
    }

    const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const { error: insertError } = await supabase.from("trial_activations_v2").insert({
      device_id: deviceId,
      display_code: displayCode,
      activated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      ip_hash: ipHash,
      user_agent: userAgent,
      user_agent_hash: userAgentHash,
      fingerprint_hash: fingerprintHash,
      last_seen_at: now.toISOString(),
    });
    if (insertError) throw insertError;

    return okResponse(expiresAt);
  } catch (error) {
    console.error("TRIAL_ACTIVATION_ERROR", error);
    return NextResponse.json(
      { success: false, error: "Gagal memeriksa trial" },
      { status: 500 },
    );
  }
  }
            
