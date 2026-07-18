import { NextResponse } from "next/server";
import { clearAccessCookies, requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);

  if (!access.ok) {
    const response = NextResponse.json(
      { active: false, error: access.error },
      { status: access.status },
    );

    if (access.status === 401 || access.status === 403) {
      clearAccessCookies(response);
    }

    return response;
  }

  return NextResponse.json(
    { active: true },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
