"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { apiRequest, jsonBody } from "@/lib/api-client";
import { buildBaseUrl, buildTenantUrl, safeNextPath } from "@/lib/tenant-host";
import type { Session } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const sessionQuery = useSession();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionQuery.isLoading || !sessionQuery.data?.user) {
      return;
    }

    const workspace =
      sessionQuery.data.workspace ||
      (sessionQuery.data.workspaces.length === 1 ? sessionQuery.data.workspaces[0] : null);

    window.location.replace(
      next
        ? next
        : workspace
          ? buildTenantUrl(workspace.subdomain, window.location.href, "/dashboard")
          : buildBaseUrl(window.location.href, "/workspaces"),
    );
  }, [next, sessionQuery.data, sessionQuery.isLoading]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/auth/login", {
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

  if (sessionQuery.isLoading || sessionQuery.data?.user) {
    return <AuthRedirectLoadingScreen message="Checking your session..." />;
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

function AuthRedirectLoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="motion-page w-full max-w-sm rounded-lg border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">Preparing sign in</p>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
