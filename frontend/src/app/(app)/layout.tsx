import { headers } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { getServerSession } from "@/lib/server/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const initialSession = await getServerSession(headerStore.get("host"));

  return <AppShell initialSession={initialSession}>{children}</AppShell>;
}
