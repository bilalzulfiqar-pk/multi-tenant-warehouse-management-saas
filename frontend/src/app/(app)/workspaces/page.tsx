"use client";

import { Building2, ExternalLink, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest, globalApi, jsonBody } from "@/lib/api-client";
import type { Workspace } from "@/lib/types";
import { compactUrlHost } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";

export default function WorkspacesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionQuery = useSession();
  const [subdomain, setSubdomain] = useState("");
  const [loading, setLoading] = useState(false);
  const workspaces = sessionQuery.data?.workspaces || [];

  async function selectWorkspace(workspace: Workspace) {
    await apiRequest("/api/session/workspace", {
      method: "POST",
      body: jsonBody({ subdomain: workspace.subdomain }),
    });
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    await queryClient.invalidateQueries({ queryKey: ["tenant"] });
    router.push("/dashboard");
    router.refresh();
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const workspace = await globalApi<Workspace>("workspaces/create", {
        method: "POST",
        body: jsonBody({
          name: form.get("name"),
          subdomain: form.get("subdomain"),
        }),
      });
      await selectWorkspace(workspace);
      toast.success("Workspace created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create workspace");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Workspaces"
        description="Create or switch tenant workspaces. Tenant data is isolated by the selected subdomain."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Your workspaces</CardTitle>
            <CardDescription>Choose the tenant context for API calls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspaces.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                No workspaces yet. Create one to begin.
              </div>
            ) : (
              workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  className="flex w-full items-center justify-between rounded-lg border bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
                  onClick={() => selectWorkspace(workspace)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-950">{workspace.name}</p>
                      <p className="text-sm text-slate-500">
                        {compactUrlHost(workspace.subdomain)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{workspace.role}</Badge>
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create workspace</CardTitle>
            <CardDescription>The creator automatically becomes Owner.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createWorkspace}>
              <div className="space-y-1.5">
                <Label htmlFor="name">Company name</Label>
                <Input id="name" name="name" placeholder="Acme Logistics" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input
                  id="subdomain"
                  name="subdomain"
                  placeholder="acme"
                  pattern="[a-z0-9-]+"
                  value={subdomain}
                  onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
                  required
                />
                <p className="text-xs text-slate-500">
                  Preview: {subdomain ? compactUrlHost(subdomain) : "acme.localhost:8000"}
                </p>
              </div>
              <Button className="w-full" disabled={loading} type="submit">
                <Plus className="h-4 w-4" />
                {loading ? "Creating..." : "Create workspace"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
