import { headers } from "next/headers";

import { EntryRedirectScreen } from "@/components/layout/entry-redirect-screen";
import { authenticatedEntryUrl, getServerSession, requestUrlFromHost } from "@/lib/server/session";

export default async function HomePage() {
  const headerStore = await headers();
  const currentUrl = requestUrlFromHost(
    headerStore.get("host"),
    headerStore.get("x-forwarded-proto"),
  );
  const session = await getServerSession(headerStore.get("host"));

  return (
    <EntryRedirectScreen
      target={session.user ? authenticatedEntryUrl(session, currentUrl) : "/login"}
      title="Preparing workspace"
      message="Checking your session and opening the right workspace..."
    />
  );
}
