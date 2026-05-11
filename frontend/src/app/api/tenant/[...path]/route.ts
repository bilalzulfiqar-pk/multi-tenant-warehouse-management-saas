import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { WORKSPACE_COOKIE } from "@/lib/server/cookies";
import { proxyToDjango } from "@/lib/server/django";
import { getTenantSubdomainFromHost } from "@/lib/tenant-host";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ path: string[] }>;
};

function djangoPath(parts: string[]) {
  return `/api/${parts.join("/")}/`;
}

async function tenantProxy(request: Request, parts: string[]) {
  const cookieStore = await cookies();
  const tenantSubdomain =
    getTenantSubdomainFromHost(request.headers.get("host")) ||
    cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (!tenantSubdomain) {
    return NextResponse.json(
      {
        error: {
          code: "workspace_required",
          message: "Select a workspace before using tenant APIs.",
          details: {},
        },
      },
      { status: 400 },
    );
  }
  return proxyToDjango({
    request,
    path: djangoPath(parts),
    tenantSubdomain,
  });
}

export async function GET(request: Request, { params }: Params) {
  return tenantProxy(request, (await params).path);
}

export async function POST(request: Request, { params }: Params) {
  return tenantProxy(request, (await params).path);
}

export async function PATCH(request: Request, { params }: Params) {
  return tenantProxy(request, (await params).path);
}

export async function DELETE(request: Request, { params }: Params) {
  return tenantProxy(request, (await params).path);
}
