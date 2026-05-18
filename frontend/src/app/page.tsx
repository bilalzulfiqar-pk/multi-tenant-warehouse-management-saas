import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authenticatedEntryUrl, getServerSession, requestUrlFromHost } from "@/lib/server/session";

export default async function HomePage() {
  const headerStore = await headers();
  const currentUrl = requestUrlFromHost(
    headerStore.get("host"),
    headerStore.get("x-forwarded-proto"),
  );
  const session = await getServerSession(headerStore.get("host"));

  redirect(session.user ? authenticatedEntryUrl(session, currentUrl) : "/login");
}
