"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, jsonBody } from "@/lib/api-client";
import { buildBaseUrl, buildTenantUrl } from "@/lib/tenant-host";
import type { Session } from "@/lib/types";

export function LoginPageContent({ next }: { next: string | null }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/session/login", {
        method: "POST",
        body: jsonBody({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      queryClient.clear();
      const session = await apiRequest<Session>("/api/session");
      const workspace =
        session.workspace || (session.workspaces.length === 1 ? session.workspaces[0] : null);
      toast.success("Welcome back");
      if (next) {
        window.location.assign(next);
        return;
      }
      window.location.assign(
        workspace
          ? buildTenantUrl(workspace.subdomain, window.location.href, "/dashboard")
          : buildBaseUrl(window.location.href, "/workspaces"),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Access your tenant workspace and inventory operations."
      footer={
        <>
          New to the project?{" "}
          <Link
            className="font-medium text-emerald-700 hover:text-emerald-800"
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          >
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button className="w-full" type="submit" isLoading={loading} loadingText="Signing in...">
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
