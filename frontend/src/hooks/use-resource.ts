"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { jsonBody, tenantApi } from "@/lib/api-client";
import type { Paginated } from "@/lib/types";

export function useTenantList<T>(
  key: string,
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
) {
  return useQuery({
    queryKey: ["tenant", key, query],
    queryFn: () => tenantApi<Paginated<T>>(path, { query }),
  });
}

export function useTenantArray<T>(key: string, path: string) {
  return useQuery({
    queryKey: ["tenant", key, "all"],
    queryFn: async () => {
      const page = await tenantApi<Paginated<T>>(path, {
        query: { page_size: 100 },
      });
      return page.results;
    },
  });
}

export function useTenantMutation<TInput>(
  key: string,
  message: string,
  mutation: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutation,
    onSuccess: async () => {
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: ["tenant", key] });
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Request failed");
    },
  });
}

export function createTenantResource<TInput>(path: string, input: TInput) {
  return tenantApi(path, { method: "POST", body: jsonBody(input) });
}

export function patchTenantResource<TInput>(path: string, input: TInput) {
  return tenantApi(path, { method: "PATCH", body: jsonBody(input) });
}

export function postTenantAction(path: string) {
  return tenantApi(path, { method: "POST", body: jsonBody({}) });
}
