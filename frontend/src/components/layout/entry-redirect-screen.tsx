"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthFlowLoadingScreen } from "@/components/auth/auth-flow-loading-screen";

export function EntryRedirectScreen({
  target,
  title,
  message,
}: {
  target: string;
  title: string;
  message: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const nextUrl = new URL(target, window.location.href);
    if (nextUrl.origin === window.location.origin) {
      router.replace(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      return;
    }

    window.location.replace(nextUrl.toString());
  }, [router, target]);

  return <AuthFlowLoadingScreen title={title} message={message} />;
}
