import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { canonicalFrontendUrl } from "@/lib/tenant-host";

function requestUrlFromBrowserHost(request: NextRequest) {
  const url = request.nextUrl.clone();
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

export function proxy(request: NextRequest) {
  const canonicalUrl = canonicalFrontendUrl(requestUrlFromBrowserHost(request));
  if (canonicalUrl) {
    return NextResponse.redirect(canonicalUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
