import { NextRequest, NextResponse } from "next/server";
import { isTemporaryPinBypassActive } from "@/lib/access-bypass";
import { safeNextPath } from "@/lib/shared/safeNextPath";

const ACCESS_COOKIE = "analisa_access_token";
const ADMIN_COOKIE = "analisa_admin_session";
const APEX_HOSTNAME = "analisa-angka.site";
const PRIMARY_HOSTNAME = "www.analisa-angka.site";

const PUBLIC_PATHS = new Set([
  "/pin",
  "/admin/login",
  "/api/pin/activate",
  "/api/logout",
  "/api/admin/login",
  "/api/admin/logout",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.ico",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  return /\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|txt|xml|json)$/i.test(pathname);
}

function requestHostname(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host") || req.nextUrl.hostname;
  return host.replace(/^\[|\]$/g, "").replace(/:\d+$/, "").toLowerCase();
}

function redirectApexToWww(req: NextRequest) {
  if (requestHostname(req) !== APEX_HOSTNAME) return null;

  // Service worker lama pada apex harus bisa mengambil pembaruan dari origin yang sama
  // agar cache aplikasi sebelum migrasi dapat dibersihkan.
  if (req.nextUrl.pathname === "/sw.js") return null;

  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = PRIMARY_HOSTNAME;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

function redirectLegacyPath(req: NextRequest) {
  if (req.nextUrl.pathname !== "/kode-login") return null;

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url, 308);
}

function isInternalAnalyzeRequest(req: NextRequest) {
  if (req.nextUrl.pathname !== "/api/analyze") return false;

  const expected = process.env.INTERNAL_API_SECRET || "";
  const input =
    req.headers.get("x-internal-secret") ||
    req.headers.get("x-internal-api-secret") ||
    "";

  return Boolean(expected && input && input === expected);
}

function redirectWithNext(req: NextRequest, target: string) {
  const { pathname, search } = req.nextUrl;
  const url = new URL(target, req.url);
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export function proxy(req: NextRequest) {
  const canonicalRedirect = redirectApexToWww(req);
  if (canonicalRedirect) return canonicalRedirect;

  const legacyRedirect = redirectLegacyPath(req);
  if (legacyRedirect) return legacyRedirect;

  const { pathname } = req.nextUrl;
  const hasAccess = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);
  const hasAdmin = Boolean(req.cookies.get(ADMIN_COOKIE)?.value);
  const bypassPin = isTemporaryPinBypassActive();

  if (bypassPin && pathname === "/pin") {
    return NextResponse.redirect(
      new URL(safeNextPath(req.nextUrl.searchParams.get("next"), "/"), req.url),
    );
  }

  if (isPublicPath(pathname) || isInternalAnalyzeRequest(req)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin/")) {
    if (hasAdmin) return NextResponse.next();
    return NextResponse.json({ error: "Admin belum login." }, { status: 401 });
  }

  if (pathname.startsWith("/admin")) {
    if (hasAdmin) return NextResponse.next();
    return redirectWithNext(req, "/admin/login");
  }

  if (bypassPin) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    if (hasAccess) return NextResponse.next();
    return NextResponse.json({ error: "Silakan masukkan PIN akses." }, { status: 401 });
  }

  if (hasAccess) return NextResponse.next();

  return redirectWithNext(req, "/pin");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
