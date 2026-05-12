"use client";

import {
  Activity,
  Boxes,
  Building2,
  ClipboardList,
  Gauge,
  Loader2,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRequireSession, useWorkspaceSwitcher } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api-client";
import { canManageMembers, canStockInOut, canViewAuditLogs, ROLE_LABELS, roleHelp } from "@/lib/permissions";
import {
  buildBaseUrl,
  buildTenantHost,
  buildTenantUrl,
  getTenantSubdomainFromHost,
} from "@/lib/tenant-host";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/products", label: "Products", icon: Package },
  { href: "/warehouses", label: "Warehouses", icon: Warehouse },
  { href: "/stock-levels", label: "Stock Levels", icon: Boxes },
  { href: "/inventory-actions", label: "Inventory Actions", icon: ClipboardList },
  { href: "/stock-movements", label: "Stock Movements", icon: Activity },
  { href: "/team", label: "Team", icon: Users },
  { href: "/audit-logs", label: "Audit Logs", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

const sidebarLabelTransition =
  "min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150 ease-out";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const sessionQuery = useRequireSession();
  const switchWorkspace = useWorkspaceSwitcher();
  const session = sessionQuery.data;
  const role = session?.workspace?.role;
  const help = roleHelp(role);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("wms_sidebar_collapsed") === "true",
  );
  const [workspaceTransition, setWorkspaceTransition] = useState<Pick<
    Workspace,
    "name" | "subdomain"
  > | null>(null);
  const currentHost = typeof window !== "undefined" ? window.location.host : "";
  const switchingBetweenTenants =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("wms_workspace_switching") === "true";

  useEffect(() => {
    if (!session?.workspace || pathname === "/workspaces") {
      return;
    }

    const hostSubdomain = getTenantSubdomainFromHost(window.location.host);
    if (hostSubdomain !== session.workspace.subdomain) {
      window.location.replace(
        buildTenantUrl(session.workspace.subdomain, window.location.href, pathname || "/dashboard"),
      );
    }
  }, [pathname, session?.workspace]);

  useEffect(() => {
    if (!session?.user || session.workspace) {
      return;
    }

    const hostSubdomain = getTenantSubdomainFromHost(window.location.host);
    if (hostSubdomain && pathname === "/accept-invite") {
      return;
    }

    if (!hostSubdomain && pathname === "/workspaces") {
      return;
    }

    const fallbackWorkspace = session.workspaces.length === 1 ? session.workspaces[0] : null;
    window.location.replace(
      fallbackWorkspace
        ? buildTenantUrl(fallbackWorkspace.subdomain, window.location.href, "/dashboard")
        : buildBaseUrl(window.location.href, "/workspaces"),
    );
  }, [pathname, session?.user, session?.workspace, session?.workspaces]);

  useEffect(() => {
    if (session?.user) {
      window.sessionStorage.removeItem("wms_workspace_switching");
    }
  }, [session?.user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function syncSessionAfterHistoryNavigation() {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      queryClient.refetchQueries({ queryKey: ["session"] });
    }

    window.addEventListener("popstate", syncSessionAfterHistoryNavigation);
    window.addEventListener("pageshow", syncSessionAfterHistoryNavigation);
    return () => {
      window.removeEventListener("popstate", syncSessionAfterHistoryNavigation);
      window.removeEventListener("pageshow", syncSessionAfterHistoryNavigation);
    };
  }, [queryClient]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("wms_sidebar_collapsed", String(next));
      return next;
    });
  }

  function selectWorkspace(workspace: Workspace) {
    if (workspace.subdomain === session?.workspace?.subdomain || switchWorkspace.isPending) {
      return;
    }

    window.sessionStorage.setItem("wms_workspace_switching", "true");
    setWorkspaceTransition({
      name: workspace.name,
      subdomain: workspace.subdomain,
    });
    switchWorkspace.mutate(workspace, {
      onError: (error) => {
        window.sessionStorage.removeItem("wms_workspace_switching");
        setWorkspaceTransition(null);
        toast.error(error instanceof Error ? error.message : "Could not switch workspace");
      },
    });
  }

  async function logout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      queryClient.clear();
      window.location.assign(buildBaseUrl(window.location.href, "/login"));
    }
  }

  if (sessionQuery.isLoading) {
    return switchingBetweenTenants ? <TenantSwitchBlankScreen /> : <WorkspaceLoadingScreen />;
  }

  if (sessionQuery.isError || !session) {
    return (
      <WorkspaceLoadErrorScreen
        message={
          sessionQuery.error instanceof Error
            ? sessionQuery.error.message
            : "The session could not be loaded."
        }
        onRetry={() => sessionQuery.refetch()}
      />
    );
  }

  if (!session.user) {
    return null;
  }

  const hostSubdomain = currentHost ? getTenantSubdomainFromHost(currentHost) : null;
  const redirectingFromUnavailableTenant =
    !session.workspace &&
    pathname !== "/accept-invite" &&
    (Boolean(hostSubdomain) || pathname !== "/workspaces");

  if (redirectingFromUnavailableTenant) {
    return <WorkspaceLoadingScreen />;
  }

  const visibleItems = navItems.filter((item) => {
    if (item.href === "/audit-logs") {
      return canViewAuditLogs(role);
    }
    if (item.href === "/team") {
      return canManageMembers(role);
    }
    if (item.href === "/inventory-actions") {
      return canStockInOut(role);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <WorkspaceTransitionOverlay workspace={workspaceTransition} />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 hidden flex-col overflow-hidden bg-slate-950 text-white transition-[width] duration-300 ease-out lg:flex",
          sidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        <div className="shrink-0 border-b border-white/10">
          <div className="mx-3 grid h-16 grid-cols-[3.5rem_minmax(0,1fr)] items-center">
            <div className="flex w-14 justify-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500 text-slate-950">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <div
              className={cn(
                sidebarLabelTransition,
                sidebarCollapsed
                  ? "pointer-events-none opacity-0"
                  : "opacity-100 delay-150",
              )}
            >
              <p className="text-sm font-semibold">Multi-Tenant WMS</p>
              <p className="text-xs text-slate-400">Warehouse SaaS</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto py-4">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mx-3 grid h-10 grid-cols-[3.5rem_minmax(0,1fr)] items-center rounded-md text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white",
                  active && "bg-white/10 text-white",
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="flex w-14 justify-center">
                  <Icon className="h-4 w-4 shrink-0" />
                </span>
                <span
                  className={cn(
                    sidebarLabelTransition,
                    "truncate",
                    sidebarCollapsed
                      ? "pointer-events-none opacity-0"
                      : "opacity-100 delay-150",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className={cn("border-t border-white/10 px-3 py-3", sidebarCollapsed && "px-2")}>
          <Button
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            className={cn(
              "w-full border-white/10 bg-white/5 text-slate-300 cursor-pointer hover:bg-white/10 hover:text-white",
              sidebarCollapsed && "h-9 px-0",
            )}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            variant="ghost"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] delay-100 duration-150 ease-out">
                  Collapse
                </span>
              </>
            )}
          </Button>
        </div>
        <div className="relative h-12 border-t border-white/10 text-xs text-slate-400">
          <div
            className={cn(
              "absolute inset-0 flex items-center px-4 transition-opacity duration-150 ease-out",
              sidebarCollapsed ? "pointer-events-none opacity-0" : "opacity-100 delay-150",
            )}
          >
            API docs: <span className="ml-1 text-slate-200">/api/docs/</span>
          </div>
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-150 ease-out",
              sidebarCollapsed ? "opacity-100 delay-150" : "pointer-events-none opacity-0",
            )}
            title="API docs available at /api/docs/"
          >
            API
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding-left] duration-300 ease-out",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {session.workspace?.name || "No workspace selected"}
                </p>
                {role ? (
                  <span className="inline-flex items-start gap-0.5">
                    <Badge variant="navy">{ROLE_LABELS[role]}</Badge>
                    {help ? (
                      <TooltipProvider delayDuration={120} disableHoverableContent>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              aria-label="Role permissions"
                              className="mt-[-1px] inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                              type="button"
                            >
                              <span className="-mt-px font-serif text-[11px] font-semibold italic leading-none">
                                i
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="center">
                            {help}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                {session.workspace
                  ? currentHost
                    ? buildTenantHost(session.workspace.subdomain, currentHost)
                    : session.workspace.subdomain
                  : "Create or select a workspace to continue"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                className="w-56"
                value={session.workspace?.subdomain || ""}
                onChange={(event) => {
                  const workspace = session.workspaces.find(
                    (item) => item.subdomain === event.target.value,
                  );
                  if (workspace) {
                    selectWorkspace(workspace);
                  }
                }}
                disabled={switchWorkspace.isPending}
              >
                <option value="">Select workspace</option>
                {session.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.subdomain}>
                    {workspace.name}
                  </option>
                ))}
              </NativeSelect>
              <Button variant="outline" asChild>
                <Link href="/workspaces">Workspaces</Link>
              </Button>
              <Button variant="ghost" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t px-4 py-2 lg:hidden">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-600",
                    active && "bg-slate-950 text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="px-4 py-5 lg:px-6">
          <div key={pathname} className="motion-page">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function WorkspaceLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="motion-page w-full max-w-sm overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="h-1 overflow-hidden bg-slate-100">
          <div className="workspace-progress h-full w-2/3 bg-emerald-500" />
        </div>
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Loading workspace</p>
            <p className="mt-1 text-sm text-slate-500">
              Preparing tenant context and permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceLoadErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="motion-page w-full max-w-sm rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <Loader2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">Could not load workspace</p>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={onRetry} size="sm">
                Retry
              </Button>
              <Button
                onClick={() => window.location.reload()}
                size="sm"
                variant="outline"
              >
                Reload page
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantSwitchBlankScreen() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 overflow-hidden bg-slate-100">
        <div className="workspace-progress h-full w-2/3 bg-emerald-500" />
      </div>
    </div>
  );
}

function WorkspaceTransitionOverlay({
  workspace,
}: {
  workspace: Pick<Workspace, "name" | "subdomain"> | null;
}) {
  if (!workspace) {
    return null;
  }

  return (
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
}
