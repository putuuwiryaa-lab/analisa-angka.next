import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "analisa_access_token";
const ADMIN_COOKIE = "analisa_admin_session";

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

function redirectWithNext(req: NextRequest, target: string) {
  const { pathname, search } = req.nextUrl;
  const url = new URL(target, req.url);
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasAccess = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);
  const hasAdmin = Boolean(req.cookies.get(ADMIN_COOKIE)?.value);

  if (isPublicPath(pathname)) {
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
