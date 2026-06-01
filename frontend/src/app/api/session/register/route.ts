import { NextResponse } from "next/server";

import { djangoRequest, setAuthCookies } from "@/lib/server/django";
import type { LoginResponse, User } from "@/lib/types";

export const runtime = "nodejs";

type RegisterBody = {
  email: string;
  full_name: string;
  password: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as RegisterBody;
  const registerResponse = await djangoRequest("POST", "/api/auth/register/", {
    body: new TextEncoder().encode(JSON.stringify(payload)).buffer,
    contentType: "application/json",
  });
  const registered = (await registerResponse.json()) as User | unknown;

  if (!registerResponse.ok) {
    return NextResponse.json(registered, { status: registerResponse.status });
  }

  const loginResponse = await djangoRequest("POST", "/api/auth/login/", {
    body: new TextEncoder()
      .encode(JSON.stringify({ email: payload.email, password: payload.password }))
      .buffer,
    contentType: "application/json",
  });
  const loginPayload = await loginResponse.json();

  if (!loginResponse.ok) {
    return NextResponse.json(loginPayload, { status: loginResponse.status });
  }

  const nextResponse = NextResponse.json({ user: (loginPayload as LoginResponse).user });
  setAuthCookies(nextResponse, loginPayload as LoginResponse);
  return nextResponse;
}
