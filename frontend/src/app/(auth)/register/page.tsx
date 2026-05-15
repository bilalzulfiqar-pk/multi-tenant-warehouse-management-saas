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
import { buildBaseUrl, safeNextPath } from "@/lib/tenant-host";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const sessionQuery = useSession();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionQuery.isLoading || !sessionQuery.data?.user) {
      return;
    }

    window.location.replace(next || buildBaseUrl(window.location.href, "/workspaces"));
  }, [next, sessionQuery.data?.user, sessionQuery.isLoading]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: jsonBody({
          email: form.get("email"),
          full_name: form.get("full_name"),
          password: form.get("password"),
        }),
      });
      queryClient.clear();
      toast.success("Account created");
      if (next) {
        window.location.assign(next);
        return;
      }
      window.location.assign(buildBaseUrl(window.location.href, "/workspaces"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (sessionQuery.isLoading || sessionQuery.data?.user) {
    return <AuthRedirectLoadingScreen message="Checking your session..." />;
  }

  return (
    <AuthCard
      title="Create account"
      description="Start with an email account, then create your first workspace."
      footer={
        <>
          Already registered?{" "}
          <Link
            className="font-medium text-emerald-700 hover:text-emerald-800"
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          >
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" autoComplete="name" required />
        </div>
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
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button className="w-full" type="submit" isLoading={loading} loadingText="Creating...">
          Create account
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
            <p className="text-sm font-semibold text-slate-950">Preparing account flow</p>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
