import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE, WORKSPACE_COOKIE, workspaceCookieOptions } from "@/lib/server/cookies";
import { djangoRequest, refreshAccessToken } from "@/lib/server/django";
import type { Paginated, Session, User, Workspace } from "@/lib/types";

export const runtime = "nodejs";

async function getJson<T>(response: Response) {
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

export async function GET() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const selectedSubdomain = cookieStore.get(WORKSPACE_COOKIE)?.value || null;

  if (!accessToken) {
    return NextResponse.json<Session>({
      user: null,
      workspace: null,
      workspaces: [],
    });
  }

  let userResponse = await djangoRequest("GET", "/api/auth/me/", { accessToken });
  if (userResponse.status === 401) {
    accessToken = (await refreshAccessToken()) || undefined;
    if (accessToken) {
      userResponse = await djangoRequest("GET", "/api/auth/me/", { accessToken });
    }
  }

  const user = await getJson<User>(userResponse);
  if (!user || !accessToken) {
    return NextResponse.json<Session>({
      user: null,
      workspace: null,
      workspaces: [],
    });
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

  if (!workspace && selectedSubdomain) {
    cookieStore.set(WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });
  }

  if (!workspace && workspaces.length === 1) {
    workspace = workspaces[0];
    cookieStore.set(WORKSPACE_COOKIE, workspace.subdomain, workspaceCookieOptions);
  }

  if (workspace && accessToken) {
    const currentResponse = await djangoRequest("GET", "/api/workspace/", {
      accessToken,
      tenantSubdomain: workspace.subdomain,
    });
    workspace = (await getJson<Workspace>(currentResponse)) || workspace;
  }

  return NextResponse.json<Session>({ user, workspace, workspaces });
}
