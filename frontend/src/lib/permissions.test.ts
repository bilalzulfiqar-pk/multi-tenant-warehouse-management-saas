import { describe, expect, it } from "vitest";

import {
  canAdjustOrTransfer,
  canManageMembers,
  canManageSetup,
  canStockInOut,
  canViewAuditLogs,
  isReadOnly,
} from "@/lib/permissions";

describe("role permissions", () => {
  it("keeps Viewer read-only", () => {
    expect(isReadOnly("viewer")).toBe(true);
    expect(canManageSetup("viewer")).toBe(false);
    expect(canStockInOut("viewer")).toBe(false);
  });

  it("allows Staff only stock in/out among mutations", () => {
    expect(canStockInOut("staff")).toBe(true);
    expect(canAdjustOrTransfer("staff")).toBe(false);
    expect(canManageMembers("staff")).toBe(false);
  });

  it("allows Manager setup, inventory, and audit but not member management", () => {
    expect(canManageSetup("manager")).toBe(true);
    expect(canAdjustOrTransfer("manager")).toBe(true);
    expect(canViewAuditLogs("manager")).toBe(true);
    expect(canManageMembers("manager")).toBe(false);
  });
});
