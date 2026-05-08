"use client";

import {
  Activity,
  Boxes,
  Building2,
  ClipboardList,
  Gauge,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select";
import { useRequireSession, useWorkspaceSwitcher } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api-client";
import { canViewAuditLogs, ROLE_LABELS, roleHelp } from "@/lib/permissions";
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
  const router = useRouter();
  const sessionQuery = useRequireSession();
  const switchWorkspace = useWorkspaceSwitcher();
  const session = sessionQuery.data;
  const role = session?.workspace?.role;
  const help = roleHelp(role);

  async function logout() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.replace("/login");
  }

  if (sessionQuery.isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!session.user) {
    return null;
  }

  const visibleItems = navItems.filter((item) => {
    if (item.href === "/audit-logs") {
      return canViewAuditLogs(role);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 text-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500 text-slate-950">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
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
                  active && "bg-white/10 text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-slate-400">
          API docs: <span className="text-slate-200">/api/docs/</span>
        </div>
      </aside>

      <div className="lg:pl-64">
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
                  ? `${session.workspace.subdomain}.localhost:8000`
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
                    switchWorkspace.mutate(workspace);
                  }
                }}
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
        <main className="px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
