import { NextResponse } from "next/server";

import { WORKSPACE_COOKIE, workspaceCookieOptions } from "@/lib/server/cookies";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { subdomain?: string };
  if (!body.subdomain) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Workspace subdomain is required.",
          details: {},
        },
      },
      { status: 400 },
    );
  }
  const response = NextResponse.json({ ok: true, subdomain: body.subdomain });
  response.cookies.set(WORKSPACE_COOKIE, body.subdomain, workspaceCookieOptions);
  return response;
}
