"use client";

import {
  Activity,
  Boxes,
  Building2,
  ClipboardList,
  FolderKanban,
  Gauge,
  Loader2,
  LogOut,
  Menu,
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
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
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
import {
  SheetClose,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AuthFlowLoadingScreen } from "@/components/auth/auth-flow-loading-screen";
import { WorkspaceTransitionOverlay } from "@/components/layout/workspace-transition-overlay";
import { useRequireSession, useWorkspaceSwitcher } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api-client";
import { canManageMembers, canStockInOut, canViewAuditLogs, ROLE_LABELS, roleHelp } from "@/lib/permissions";
import {
  buildBaseUrl,
  buildTenantHost,
  buildTenantUrl,
  getTenantSubdomainFromHost,
} from "@/lib/tenant-host";
import type { Session, Workspace } from "@/lib/types";
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

export function AppShell({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: Session;
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const sessionQuery = useRequireSession(initialSession);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isTabletShell, setIsTabletShell] = useState(false);
  const [tabletVisibleCount, setTabletVisibleCount] = useState(0);
  const currentHost = typeof window !== "undefined" ? window.location.host : "";
  const switchingBetweenTenants =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("wms_workspace_switching") === "true";
  const tabletNavRef = useRef<HTMLDivElement | null>(null);
  const tabletMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 640px) and (max-width: 1023px)");
    const syncTabletMode = () => setIsTabletShell(mediaQuery.matches);
    syncTabletMode();
    mediaQuery.addEventListener("change", syncTabletMode);
    return () => mediaQuery.removeEventListener("change", syncTabletMode);
  }, []);

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

    setMobileMenuOpen(false);
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
    setMobileMenuOpen(false);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      queryClient.clear();
      window.location.assign(buildBaseUrl(window.location.href, "/login"));
    }
  }

  function requireWorkspaceForNavigation(event: MouseEvent<HTMLElement>) {
    if (session?.workspace) {
      return;
    }

    event.preventDefault();
    setMobileMenuOpen(false);
    toast.info("Select or create a workspace first to open workspace pages.");
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

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !isTabletShell) {
      return;
    }

    const container = tabletNavRef.current;
    if (!container) {
      return;
    }

    let frame = 0;
    const recalculate = () => {
      const availableWidth = container.clientWidth;
      if (!availableWidth) {
        return;
      }

      const styles = window.getComputedStyle(container);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const widths = visibleItems.map((item) => {
        const element = tabletMeasureRefs.current[item.href];
        return element ? Math.ceil(element.getBoundingClientRect().width) : 0;
      });

      if (widths.some((width) => width === 0)) {
        return;
      }

      let usedWidth = 0;
      let count = 0;
      for (const width of widths) {
        const nextWidth = width + (count > 0 ? gap : 0);
        if (count === 0 || usedWidth + nextWidth <= availableWidth) {
          usedWidth += nextWidth;
          count += 1;
          continue;
        }
        break;
      }

      setTabletVisibleCount((current) => {
        const next = Math.max(1, count);
        return current === next ? current : next;
      });
    };

    const scheduleRecalculate = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(recalculate);
    };

    scheduleRecalculate();
    const observer = new ResizeObserver(scheduleRecalculate);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [isTabletShell, visibleItems]);

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
  const hostNeedsTenantRedirect =
    Boolean(session.workspace) &&
    pathname !== "/workspaces" &&
    hostSubdomain !== session.workspace?.subdomain;
  const redirectingFromUnavailableTenant =
    !session.workspace &&
    pathname !== "/accept-invite" &&
    (Boolean(hostSubdomain) || pathname !== "/workspaces");

  if (hostNeedsTenantRedirect || redirectingFromUnavailableTenant) {
    return <TenantSwitchBlankScreen />;
  }

  const tabletVisibleItems =
    isTabletShell && tabletVisibleCount > 0
      ? visibleItems.slice(0, tabletVisibleCount)
      : [];
  const drawerNavItems = isTabletShell ? visibleItems.slice(tabletVisibleItems.length) : visibleItems;
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
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
                onClick={(event) => requireWorkspaceForNavigation(event)}
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
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <PanelLeftClose className="h-4 w-4 shrink-0" />
                </span>
                <span className="min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] delay-100 duration-150 ease-out">
                  Collapse
                </span>
              </>
            )}
          </Button>
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding-left] duration-300 ease-out",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
          <div className="lg:hidden">
            <div className="flex min-h-15 items-center justify-between gap-3 px-4 py-3">
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
              </div>
              <Sheet modal={false} open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    aria-label="Open menu"
                    className="h-9 w-9 shrink-0"
                    size="icon"
                    variant="outline"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>{session.workspace?.name || "Menu"}</SheetTitle>
                    <SheetDescription>
                      {session.workspace
                        ? currentHost
                          ? buildTenantHost(session.workspace.subdomain, currentHost)
                          : session.workspace.subdomain
                        : "Create or select a workspace to continue"}
                    </SheetDescription>
                  </SheetHeader>

                  {drawerNavItems.length ? (
                    <div className="border-t pt-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                        Pages
                      </p>
                      <div className="space-y-1">
                        {drawerNavItems.map((item) => {
                          const Icon = item.icon;
                          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                          return (
                            <SheetClose asChild key={item.href}>
                              <Link
                                href={item.href}
                                onClick={(event) => requireWorkspaceForNavigation(event)}
                                className={cn(
                                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950",
                                  active && "bg-slate-950 text-white hover:bg-slate-950 hover:text-white",
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                {item.label}
                              </Link>
                            </SheetClose>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 border-t pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      Workspace
                    </p>
                    <NativeSelect
                      className="w-full"
                      placeholder="Select workspace"
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
                      {session.workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.subdomain}>
                          {workspace.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="mt-5 border-t pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      Utilities
                    </p>
                    <div className="space-y-1">
                      <SheetClose asChild>
                        <Link
                          href="/workspaces"
                          className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                        >
                          <FolderKanban className="h-4 w-4 shrink-0" />
                          Workspaces
                        </Link>
                      </SheetClose>
                      <button
                        className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                        onClick={logout}
                        type="button"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <nav className="relative hidden border-t px-4 py-2 sm:block lg:hidden">
              <div
                ref={tabletNavRef}
                className={cn(
                  "flex items-center gap-1.5",
                  isTabletShell && tabletVisibleCount === 0 && "invisible",
                )}
              >
                {tabletVisibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(event) => requireWorkspaceForNavigation(event)}
                      className={cn(
                        "flex basis-auto grow items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-slate-600",
                        active && "bg-slate-950 text-white",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-0 overflow-hidden opacity-0 sm:block lg:hidden">
                <div className="flex w-max items-center gap-1.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.href}
                        ref={(node) => {
                          tabletMeasureRefs.current[item.href] = node;
                        }}
                        className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>

          <div className="hidden min-h-16 flex-col gap-3 px-4 py-3 lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:px-6">
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
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:flex-nowrap">
              <NativeSelect
                className="w-full sm:min-w-56 sm:flex-1 lg:w-56 lg:flex-none"
                placeholder="Select workspace"
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
                {session.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.subdomain}>
                    {workspace.name}
                  </option>
                ))}
              </NativeSelect>
              <div className="flex items-center gap-2 sm:ml-auto lg:ml-0">
                <Button className="flex-1 sm:flex-none" variant="outline" asChild>
                  <Link href="/workspaces">Workspaces</Link>
                </Button>
                <Button className="flex-1 sm:flex-none" variant="ghost" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
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
    <AuthFlowLoadingScreen
      title="Loading workspace"
      message="Preparing tenant context and permissions..."
    />
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

