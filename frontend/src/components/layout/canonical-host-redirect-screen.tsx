"use client";

import { useEffect } from "react";

import { AuthFlowLoadingScreen } from "@/components/auth/auth-flow-loading-screen";
import { canonicalFrontendUrl } from "@/lib/tenant-host";

export function CanonicalHostRedirectScreen() {
  useEffect(() => {
    const target = canonicalFrontendUrl(window.location.href);
    if (target) {
      window.location.replace(target);
    }
  }, []);

  return (
    <AuthFlowLoadingScreen
      title="Preparing workspace"
      message="Opening the correct local workspace host..."
    />
  );
}
