import { NextResponse } from "next/server";

import { djangoRequest, setAuthCookies } from "@/lib/server/django";
import type { LoginResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.arrayBuffer();
  const response = await djangoRequest("POST", "/api/auth/login/", {
    body,
    contentType: request.headers.get("content-type") || "application/json",
  });
  const payload = await response.json();

  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  const nextResponse = NextResponse.json({ user: (payload as LoginResponse).user });
  setAuthCookies(nextResponse, payload as LoginResponse);
  return nextResponse;
}
