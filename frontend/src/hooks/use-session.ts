"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { apiRequest, jsonBody } from "@/lib/api-client";
import type { Session, Workspace } from "@/lib/types";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiRequest<Session>("/api/session"),
  });
}

export function useRequireSession() {
  const router = useRouter();
  const query = useSession();

  useEffect(() => {
    if (!query.isLoading && query.data && !query.data.user) {
      router.replace("/login");
    }
  }, [query.data, query.isLoading, router]);

  return query;
}

export function useWorkspaceSwitcher() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (workspace: Workspace) =>
      apiRequest<{ ok: boolean }>("/api/session/workspace", {
        method: "POST",
        body: jsonBody({ subdomain: workspace.subdomain }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
      router.push("/dashboard");
      router.refresh();
    },
  });
}
