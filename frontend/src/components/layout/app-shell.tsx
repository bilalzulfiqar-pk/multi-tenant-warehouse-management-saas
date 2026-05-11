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
import { useRequireSession, useWorkspaceSwitcher } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api-client";
import { canViewAuditLogs, ROLE_LABELS, roleHelp } from "@/lib/permissions";
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
  const [currentHost] = useState(() =>
    typeof window !== "undefined" ? window.location.host : "",
  );
  const [workspaceTransition, setWorkspaceTransition] = useState<Pick<
    Workspace,
    "name" | "subdomain"
  > | null>(null);
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

  if (sessionQuery.isLoading || !session) {
    return switchingBetweenTenants ? <TenantSwitchBlankScreen /> : <WorkspaceLoadingScreen />;
  }

  if (!session.user) {
    return null;
  }

  const hostSubdomain = currentHost ? getTenantSubdomainFromHost(currentHost) : null;
  const redirectingFromUnavailableTenant =
    !session.workspace && (Boolean(hostSubdomain) || pathname !== "/workspaces");

  if (redirectingFromUnavailableTenant) {
    return <WorkspaceLoadingScreen />;
  }

  const visibleItems = navItems.filter((item) => {
    if (item.href === "/audit-logs") {
      return canViewAuditLogs(role);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <WorkspaceTransitionOverlay workspace={workspaceTransition} />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 hidden flex-col bg-slate-950 text-white transition-[width] duration-200 ease-out lg:flex",
          sidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-3 border-b border-white/10 px-4",
            sidebarCollapsed && "justify-center",
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500 text-slate-950">
            <Building2 className="h-5 w-5" />
          </div>
          <div className={cn("min-w-0", sidebarCollapsed && "hidden")}>
            <p className="text-sm font-semibold">Multi-Tenant WMS</p>
            <p className="text-xs text-slate-400">Warehouse SaaS</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white",
                  sidebarCollapsed && "justify-center px-2",
                  active && "bg-white/10 text-white",
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(sidebarCollapsed && "sr-only")}>{item.label}</span>
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
                Collapse
              </>
            )}
          </Button>
        </div>
        <div
          className={cn(
            "border-t border-white/10 p-4 text-xs text-slate-400",
            sidebarCollapsed && "px-2 text-center",
          )}
        >
          {sidebarCollapsed ? (
            <span title="API docs available at /api/docs/">API</span>
          ) : (
            <>
              API docs: <span className="text-slate-200">/api/docs/</span>
            </>
          )}
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding-left] duration-200 ease-out",
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
                {role ? <Badge variant="navy">{ROLE_LABELS[role]}</Badge> : null}
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
          {help ? (
            <div className="border-t bg-amber-50 px-4 py-2 text-sm text-amber-800 lg:px-6">
              {help}
            </div>
          ) : null}
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
