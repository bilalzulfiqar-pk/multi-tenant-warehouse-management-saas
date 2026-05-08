import http from "node:http";
import https from "node:https";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { LoginResponse } from "@/lib/types";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  expiredCookieOptions,
  refreshCookieOptions,
} from "@/lib/server/cookies";

const backendOrigin = process.env.BACKEND_INTERNAL_ORIGIN || "http://localhost:8000";
const tenantHostSuffix = process.env.TENANT_BACKEND_HOST_SUFFIX || "localhost:8000";

type DjangoProxyOptions = {
  request: Request;
  path: string;
  tenantSubdomain?: string | null;
  authenticated?: boolean;
  retryOnUnauthorized?: boolean;
};

function targetUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, backendOrigin);
}

function requestBody(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }
  return request.arrayBuffer();
}

function responseHeaders(headers: http.IncomingHttpHeaders) {
  const result = new Headers();
  const contentType = headers["content-type"];
  if (contentType) {
    result.set("content-type", Array.isArray(contentType) ? contentType[0] : contentType);
  }
  return result;
}

function readIncoming(response: http.IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    response.on("end", () => resolve(Buffer.concat(chunks)));
    response.on("error", reject);
  });
}

export async function djangoRequest(
  method: string,
  path: string,
  {
    body,
    accessToken,
    tenantSubdomain,
    contentType,
  }: {
    body?: ArrayBuffer;
    accessToken?: string;
    tenantSubdomain?: string | null;
    contentType?: string | null;
  } = {},
) {
  const url = targetUrl(path);
  const client = url.protocol === "https:" ? https : http;
  const hostHeader = tenantSubdomain
    ? `${tenantSubdomain}.${tenantHostSuffix}`
    : url.host;
  const bodyBuffer = body ? Buffer.from(body) : undefined;

  return new Promise<Response>((resolve, reject) => {
    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          accept: "application/json",
          host: hostHeader,
          ...(contentType ? { "content-type": contentType } : {}),
          ...(bodyBuffer ? { "content-length": Buffer.byteLength(bodyBuffer) } : {}),
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
      },
      async (res) => {
        const buffer = await readIncoming(res);
        resolve(
          new Response(buffer.toString(), {
            status: res.statusCode || 500,
            headers: responseHeaders(res.headers),
          }),
        );
      },
    );

    req.on("error", reject);
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

export async function refreshAccessToken() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return null;
  }

  const response = await djangoRequest("POST", "/api/auth/token/refresh/", {
    body: new TextEncoder().encode(JSON.stringify({ refresh: refreshToken })).buffer,
    contentType: "application/json",
  });

  if (!response.ok) {
    clearAuthCookies(cookieStore);
    return null;
  }

  const data = (await response.json()) as { access?: string };
  if (!data.access) {
    clearAuthCookies(cookieStore);
    return null;
  }

  cookieStore.set(ACCESS_COOKIE, data.access, accessCookieOptions);
  return data.access;
}

export async function proxyToDjango({
  request,
  path,
  tenantSubdomain,
  authenticated = true,
  retryOnUnauthorized = true,
}: DjangoProxyOptions) {
  const cookieStore = await cookies();
  const body = await requestBody(request);
  const contentType = request.headers.get("content-type");
  let accessToken = authenticated ? cookieStore.get(ACCESS_COOKIE)?.value : undefined;
  const search = new URL(request.url).search;
  const pathWithSearch = `${path}${search}`;

  let response = await djangoRequest(request.method, pathWithSearch, {
    body,
    contentType,
    accessToken,
    tenantSubdomain,
  });

  if (response.status === 401 && authenticated && retryOnUnauthorized) {
    accessToken = (await refreshAccessToken()) || undefined;
    if (accessToken) {
      response = await djangoRequest(request.method, pathWithSearch, {
        body,
        contentType,
        accessToken,
        tenantSubdomain,
      });
    }
  }

  if (response.status === 401) {
    clearAuthCookies(cookieStore);
  }

  return response;
}

export function setAuthCookies(response: NextResponse, data: LoginResponse) {
  response.cookies.set(ACCESS_COOKIE, data.access, accessCookieOptions);
  response.cookies.set(REFRESH_COOKIE, data.refresh, refreshCookieOptions);
}

export function clearAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(ACCESS_COOKIE, "", expiredCookieOptions);
  cookieStore.set(REFRESH_COOKIE, "", expiredCookieOptions);
}

export function clearAuthResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, "", expiredCookieOptions);
  response.cookies.set(REFRESH_COOKIE, "", expiredCookieOptions);
  return response;
}
