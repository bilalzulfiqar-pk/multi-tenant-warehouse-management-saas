"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/domain/field";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { tenantApi, jsonBody } from "@/lib/api-client";

export default function AcceptInvitePage() {
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
      toast.success("Invite accepted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invite could not be accepted");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Accept Invite"
        description="Accept a manual workspace invite token for the currently selected tenant."
      />
      <Alert className="mb-4">
        Select the invited workspace first, then accept the token with an account using the invited email address.
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
            <Button disabled={loading} type="submit">
              {loading ? "Accepting..." : "Accept invite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
