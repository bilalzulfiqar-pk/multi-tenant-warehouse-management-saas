import type { WorkspaceRole } from "@/lib/types";

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

const setupRoles: WorkspaceRole[] = ["owner", "admin", "manager"];
const inventoryRoles: WorkspaceRole[] = ["owner", "admin", "manager"];
const stockInOutRoles: WorkspaceRole[] = ["owner", "admin", "manager", "staff"];
const memberRoles: WorkspaceRole[] = ["owner", "admin"];
const auditRoles: WorkspaceRole[] = ["owner", "admin", "manager"];

export function canManageSetup(role?: WorkspaceRole | null) {
  return Boolean(role && setupRoles.includes(role));
}

export function canStockInOut(role?: WorkspaceRole | null) {
  return Boolean(role && stockInOutRoles.includes(role));
}

export function canAdjustOrTransfer(role?: WorkspaceRole | null) {
  return Boolean(role && inventoryRoles.includes(role));
}

export function canManageMembers(role?: WorkspaceRole | null) {
  return Boolean(role && memberRoles.includes(role));
}

export function canViewAuditLogs(role?: WorkspaceRole | null) {
  return Boolean(role && auditRoles.includes(role));
}

export function canEditWorkspaceSettings(role?: WorkspaceRole | null) {
  return role === "owner";
}

export function isReadOnly(role?: WorkspaceRole | null) {
  return role === "viewer";
}

export function roleHelp(role?: WorkspaceRole | null) {
  if (role === "viewer") {
    return "You have Viewer access. Contact an Admin to make inventory changes.";
  }
  if (role === "staff") {
    return "Staff can perform Stock In and Stock Out, but cannot adjust or transfer stock.";
  }
  return null;
}
