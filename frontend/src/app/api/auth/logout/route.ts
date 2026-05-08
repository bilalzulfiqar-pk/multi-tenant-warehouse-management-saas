import { clearAuthResponse } from "@/lib/server/django";

export const runtime = "nodejs";

export async function POST() {
  return clearAuthResponse();
}
