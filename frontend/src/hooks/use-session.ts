"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { apiRequest, jsonBody } from "@/lib/api-client";
import { buildTenantUrl } from "@/lib/tenant-host";
import type { Session, Workspace } from "@/lib/types";

export function useSession(initialData?: Session) {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiRequest<Session>("/api/session"),
    initialData,
  });
}

export function useRequireSession(initialData?: Session) {
  const router = useRouter();
  const query = useSession(initialData);

  useEffect(() => {
    if (!query.isLoading && query.data && !query.data.user) {
      const next =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [query.data, query.isLoading, router]);

  return query;
}

export function useWorkspaceSwitcher() {
  return useMutation({
    mutationFn: (workspace: Workspace) =>
      apiRequest<{ ok: boolean; redirect_url?: string }>("/api/session/workspace", {
        method: "POST",
        body: jsonBody({ subdomain: workspace.subdomain }),
      }),
    onSuccess: (data, workspace) => {
      window.location.assign(data.redirect_url || buildTenantUrl(workspace.subdomain, window.location.href));
    },
  });
}
