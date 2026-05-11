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
import { buildBaseUrl } from "@/lib/tenant-host";

export default function RegisterPage() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

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
      window.location.assign(buildBaseUrl(window.location.href, "/workspaces"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      description="Start with an email account, then create your first workspace."
      footer={
        <>
          Already registered?{" "}
          <Link className="font-medium text-emerald-700 hover:text-emerald-800" href="/login">
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
