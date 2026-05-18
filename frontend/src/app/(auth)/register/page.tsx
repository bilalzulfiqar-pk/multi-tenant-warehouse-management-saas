import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { RegisterPageContent } from "@/components/auth/register-page-content";
import {
  authenticatedEntryUrl,
  getServerSession,
  requestUrlFromHost,
} from "@/lib/server/session";
import { safeNextPath } from "@/lib/tenant-host";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstValue(params.next));
  const headerStore = await headers();
  const currentUrl = requestUrlFromHost(
    headerStore.get("host"),
    headerStore.get("x-forwarded-proto"),
  );
  const session = await getServerSession(headerStore.get("host"));

  if (session.user) {
    redirect(next || authenticatedEntryUrl(session, currentUrl));
  }

  return <RegisterPageContent next={next} />;
}
