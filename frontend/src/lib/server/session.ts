import { cookies } from "next/headers";

import { buildBaseUrl, buildTenantUrl, getTenantSubdomainFromHost } from "@/lib/tenant-host";
import type { Paginated, Session, User, Workspace } from "@/lib/types";

import { ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE } from "./cookies";
import { djangoRequest } from "./django";

async function getJson<T>(response: Response) {
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

async function refreshAccessTokenValue(refreshToken: string) {
  const response = await djangoRequest("POST", "/api/auth/token/refresh/", {
    body: new TextEncoder().encode(JSON.stringify({ refresh: refreshToken })).buffer,
    contentType: "application/json",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { access?: string };
  return data.access || null;
}

async function getAccessToken() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value || null;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value || null;

  if (!accessToken && refreshToken) {
    accessToken = await refreshAccessTokenValue(refreshToken);
  }

  return { accessToken, refreshToken };
}

export async function getServerSession(host: string | null): Promise<Session> {
  const cookieStore = await cookies();
  const cookieSubdomain = cookieStore.get(WORKSPACE_COOKIE)?.value || null;
  const hostSubdomain = getTenantSubdomainFromHost(host);
  const selectedSubdomain = hostSubdomain || cookieSubdomain;
  const { accessToken: initialAccessToken, refreshToken } = await getAccessToken();
  let accessToken = initialAccessToken;

  if (!accessToken) {
    return {
      user: null,
      workspace: null,
      workspaces: [],
    };
  }

  let userResponse = await djangoRequest("GET", "/api/auth/me/", { accessToken });
  if (userResponse.status === 401 && refreshToken) {
    accessToken = await refreshAccessTokenValue(refreshToken);
    if (accessToken) {
      userResponse = await djangoRequest("GET", "/api/auth/me/", { accessToken });
    }
  }

  const user = await getJson<User>(userResponse);
  if (!user || !accessToken) {
    return {
      user: null,
      workspace: null,
      workspaces: [],
    };
  }

  const workspaceResponse = await djangoRequest("GET", "/api/workspaces/?page_size=100", {
    accessToken,
  });
  const workspacePayload =
    (await getJson<Workspace[] | Paginated<Workspace>>(workspaceResponse)) || [];
  const workspaces = Array.isArray(workspacePayload)
    ? workspacePayload
    : workspacePayload.results;

  let workspace = workspaces.find((item) => item.subdomain === selectedSubdomain) || null;

  if (!hostSubdomain && !workspace && workspaces.length === 1) {
    workspace = workspaces[0];
  }

  if (workspace) {
    const currentResponse = await djangoRequest("GET", "/api/workspace/", {
      accessToken,
      tenantSubdomain: workspace.subdomain,
    });
    workspace = (await getJson<Workspace>(currentResponse)) || workspace;
  }

  return { user, workspace, workspaces };
}

export function requestUrlFromHost(host: string | null, forwardedProto: string | null, path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${forwardedProto || "http"}://${host || "localhost:3000"}${normalizedPath}`;
}

export function authenticatedEntryUrl(session: Session, currentUrl: string) {
  if (session.workspace) {
    return buildTenantUrl(session.workspace.subdomain, currentUrl, "/dashboard");
  }

  return buildBaseUrl(currentUrl, "/workspaces");
}
