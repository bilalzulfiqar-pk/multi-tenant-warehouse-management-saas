import { NextResponse } from "next/server";

import { WORKSPACE_COOKIE, workspaceCookieOptions } from "@/lib/server/cookies";
import { buildTenantUrl } from "@/lib/tenant-host";

export const runtime = "nodejs";

function requestUrlFromBrowserHost(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (host) {
    url.host = host;
  }
  if (forwardedProto) {
    url.protocol = `${forwardedProto}:`;
  }

  return url.toString();
}

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
  const response = NextResponse.json({
    ok: true,
    subdomain: body.subdomain,
    redirect_url: buildTenantUrl(body.subdomain, requestUrlFromBrowserHost(request), "/dashboard"),
  });
  response.cookies.set(WORKSPACE_COOKIE, body.subdomain, workspaceCookieOptions);
  return response;
}
