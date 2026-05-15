import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginPageContent } from "@/components/auth/login-page-content";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/cookies";
import { safeNextPath } from "@/lib/tenant-host";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstValue(params.next));
  const cookieStore = await cookies();
  const hasSessionCookie =
    Boolean(cookieStore.get(ACCESS_COOKIE)?.value) ||
    Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (hasSessionCookie) {
    redirect(next || "/");
  }

  return <LoginPageContent next={next} />;
}
