"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/domain/field";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { tenantApi, jsonBody } from "@/lib/api-client";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitePageContent />
    </Suspense>
  );
}

function AcceptInvitePageContent() {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") || "");
  const [loading, setLoading] = useState(false);

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
    <div>
      <PageHeader
        title="Accept invite"
        description="Review and accept this tenant workspace invite."
      />
      <Alert className="mb-4">
        Use an account with the invited email address. This invite will add you to the current tenant workspace.
      </Alert>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Invite token</CardTitle>
          <CardDescription>Paste the token from the invite link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Token">
              <Input value={token} onChange={(event) => setToken(event.target.value)} required />
            </Field>
            <Button isLoading={loading} loadingText="Accepting..." type="submit">
              Accept invite
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
