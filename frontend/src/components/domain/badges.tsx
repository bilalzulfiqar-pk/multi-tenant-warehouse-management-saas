import { Badge } from "@/components/ui/badge";
import type { MovementType, WarehouseStatus, WorkspaceRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/permissions";
import { titleCase } from "@/lib/utils";

export function StatusBadge({
  value,
}: {
  value:
    | WarehouseStatus
    | "active"
    | "inactive"
    | "pending"
    | "accepted"
    | "expired"
    | "cancelled"
    | "disabled"
    | "invited";
}) {
  const variant =
    value === "active" || value === "accepted"
      ? "success"
      : value === "pending"
        ? "warning"
        : value === "inactive" || value === "disabled"
          ? "default"
          : "danger";
  return <Badge variant={variant}>{titleCase(value)}</Badge>;
}

export function BooleanBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "success" : "default"}>{active ? "Active" : "Inactive"}</Badge>;
}

export function RoleBadge({ role }: { role: WorkspaceRole }) {
  return <Badge variant={role === "owner" ? "navy" : "info"}>{ROLE_LABELS[role]}</Badge>;
}

export function MovementBadge({ type }: { type: MovementType }) {
  const variant =
    type === "stock_in"
      ? "success"
      : type === "stock_out"
        ? "warning"
        : type === "adjustment"
          ? "purple"
          : "info";
  return <Badge variant={variant}>{titleCase(type)}</Badge>;
}
