"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/domain/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, tenantApi, jsonBody } from "@/lib/api-client";
import { useSession } from "@/hooks/use-session";
import type { InviteAcceptancePreview } from "@/lib/types";

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
  const [preview, setPreview] = useState<InviteAcceptancePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!sessionQuery.data?.user) {
        setPreview(null);
        setPreviewLoading(false);
        return;
      }

      if (!token) {
        setPreview({
          status: "invalid",
          can_accept: false,
          message: "Invite token is missing.",
        });
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      try {
        const nextPreview = await tenantApi<InviteAcceptancePreview>("invites/accept", {
          query: { token },
        });
        if (!cancelled) {
          setPreview(nextPreview);
        }
      } catch (error) {
        if (!cancelled) {
          setPreview({
            status: "invalid",
            can_accept: false,
            message: error instanceof Error ? error.message : "Invite could not be checked.",
          });
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    if (!sessionQuery.isLoading) {
      void loadPreview();
    }

    return () => {
      cancelled = true;
    };
  }, [sessionQuery.data?.user, sessionQuery.isLoading, token]);

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

  async function signOutAndSwitchAccount() {
    const next =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/accept-invite";

    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      queryClient.clear();
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }

  if (sessionQuery.isLoading || !sessionQuery.data?.user) {
    return (
      <InviteRouteLoadingScreen
        message={
          sessionQuery.isLoading
            ? "Checking your session and invite access..."
            : "Redirecting you to sign in..."
        }
      />
    );
  }

  return (
    <AuthCard
      title="Accept invite"
      description="Join this workspace using the invited email address."
      footer="Invites can only be accepted by the invited email address."
    >
      <div className="space-y-4">
        {previewLoading ? (
          <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Checking invite status...
          </div>
        ) : preview && !preview.can_accept ? (
          <>
            <Alert>{preview.message}</Alert>
            {preview.email ? (
              <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Invited email: <span className="font-medium text-slate-950">{preview.email}</span>
              </div>
            ) : null}
            {preview.status === "wrong_email" ? (
              <>
                <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Signed in as:{" "}
                  <span className="font-medium text-slate-950">
                    {sessionQuery.data.user.email}
                  </span>
                </div>
                <div className="flex justify-start">
                  <Button type="button" variant="outline" onClick={signOutAndSwitchAccount}>
                    Sign out
                  </Button>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <form className="grid gap-4" onSubmit={submit}>
            <Alert>
              Sign in with the invited email address, then confirm the invite to join this workspace.
            </Alert>
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

function InviteRouteLoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="motion-page w-full max-w-sm rounded-lg border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">Preparing invite</p>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
