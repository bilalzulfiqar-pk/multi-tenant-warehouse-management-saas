"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/domain/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tenantApi, jsonBody } from "@/lib/api-client";
import { useSession } from "@/hooks/use-session";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitePageContent />
    </Suspense>
  );
}

function AcceptInvitePageContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const sessionQuery = useSession();
  const [token, setToken] = useState(params.get("token") || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionQuery.isLoading || sessionQuery.data?.user) {
      return;
    }

    const next =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/accept-invite";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [router, sessionQuery.data?.user, sessionQuery.isLoading]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await tenantApi("invites/accept", {
        method: "POST",
        body: jsonBody({ token }),
      });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
      toast.success("Invite accepted");
      window.location.assign(new URL("/dashboard", window.location.href).toString());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invite could not be accepted");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Accept invite"
      description="Join this workspace using the invited email address."
      footer="Invites can only be accepted by the invited email address."
    >
      <div className="space-y-4">
        <Alert>
          Sign in with the invited email address, then confirm the invite to join this workspace.
        </Alert>

        {sessionQuery.isLoading || !sessionQuery.data?.user ? (
          <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Checking your session...
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Token">
              <Input value={token} onChange={(event) => setToken(event.target.value)} required />
            </Field>
            <Button className="w-full sm:w-auto" isLoading={loading} loadingText="Accepting..." type="submit">
              Accept invite
            </Button>
          </form>
        )}
      </div>
    </AuthCard>
  );
}
