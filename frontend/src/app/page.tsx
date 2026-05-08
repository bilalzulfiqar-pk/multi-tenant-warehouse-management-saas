import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_COOKIE } from "@/lib/server/cookies";

export default async function HomePage() {
  const cookieStore = await cookies();
  redirect(cookieStore.get(ACCESS_COOKIE) ? "/dashboard" : "/login");
}
