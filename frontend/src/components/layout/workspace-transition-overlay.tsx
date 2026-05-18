"use client";

import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";

import type { Workspace } from "@/lib/types";

export function WorkspaceTransitionOverlay({
  workspace,
}: {
  workspace: Pick<Workspace, "name" | "subdomain"> | null;
}) {
  if (!workspace) {
    return null;
  }

  const overlay = (
    <div
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
      role="status"
    >
      <div className="motion-page w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-white shadow-2xl">
        <div className="h-1 overflow-hidden bg-slate-100">
          <div className="workspace-progress h-full w-2/3 bg-emerald-500" />
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">Switching workspace</p>
              <p className="mt-1 truncate text-base font-medium text-slate-900">
                {workspace.name}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Moving to {workspace.subdomain} tenant context.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
}
