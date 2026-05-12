"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/domain/field";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { tenantApi, jsonBody } from "@/lib/api-client";
import { canEditWorkspaceSettings } from "@/lib/permissions";
import { buildTenantHost } from "@/lib/tenant-host";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const workspace = session?.workspace;
  const canEdit = canEditWorkspaceSettings(workspace?.role);
  const currentHost = typeof window !== "undefined" ? window.location.host : "";
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await tenantApi("workspace", {
        method: "PATCH",
        body: jsonBody({
          name: form.get("name"),
          default_timezone: form.get("default_timezone"),
          low_stock_dashboard_enabled: form.get("low_stock_dashboard_enabled") === "true",
        }),
      });
      toast.success("Workspace settings saved");
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Workspace Settings"
        description="Owner-only tenant settings for dashboard behavior and workspace identity."
      />
      {!canEdit ? (
        <Alert variant="warning" className="mb-4">
          Only workspace Owners can update these settings.
        </Alert>
      ) : null}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{workspace?.name || "Workspace"}</CardTitle>
          <CardDescription>
            {workspace
              ? currentHost
                ? buildTenantHost(workspace.subdomain, currentHost)
                : workspace.subdomain
              : "No workspace selected"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Workspace name">
              <Input
                name="name"
                defaultValue={workspace?.name || ""}
                disabled={!canEdit}
                required
              />
            </Field>
            <Field label="Default timezone">
              <Input
                name="default_timezone"
                defaultValue={workspace?.default_timezone || "UTC"}
                disabled={!canEdit}
                required
              />
            </Field>
            <Field label="Low-stock dashboard">
              <NativeSelect
                name="low_stock_dashboard_enabled"
                defaultValue={String(workspace?.low_stock_dashboard_enabled ?? true)}
                disabled={!canEdit}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </NativeSelect>
            </Field>
            <Button type="submit" disabled={!canEdit} isLoading={saving} loadingText="Saving...">
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
