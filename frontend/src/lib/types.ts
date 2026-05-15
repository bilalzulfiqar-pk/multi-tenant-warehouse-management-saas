export type WorkspaceRole = "owner" | "admin" | "manager" | "staff" | "viewer";
export type MembershipStatus = "active" | "disabled" | "invited";
export type InviteStatus = "pending" | "accepted" | "expired" | "cancelled";
export type WarehouseStatus = "active" | "inactive";
export type LocationType = "storage" | "receiving" | "dispatch" | "adjustment" | "other";
export type MovementType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "transfer_in"
  | "transfer_out";

export type User = {
  id: string;
  email: string;
  full_name: string;
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: User;
};

export type Workspace = {
  id: string;
  name: string;
  slug?: string;
  subdomain: string;
  status: "active" | "suspended" | "archived";
  role: WorkspaceRole;
  default_timezone?: string;
  low_stock_dashboard_enabled?: boolean;
};

export type MemberUser = {
  id: string;
  email: string;
  full_name: string;
};

export type Membership = {
  id: string;
  user: MemberUser;
  role: WorkspaceRole;
  status: MembershipStatus;
  invited_by: MemberUser | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Invite = {
  id: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: InviteStatus;
  expires_at: string;
  accepted_at: string | null;
  invited_by: MemberUser;
  accepted_by: MemberUser | null;
  invite_link: string;
  created_at: string;
  updated_at: string;
};

export type Warehouse = {
  id: string;
  name: string;
  code: string;
  address_line1: string;
  address_line2: string;
  city: string;
  country: string;
  status: WarehouseStatus;
  created_at: string;
  updated_at: string;
};

export type WarehouseLocation = {
  id: string;
  warehouse: string;
  warehouse_detail?: Warehouse;
  name: string;
  code: string;
  location_type: LocationType;
  status: WarehouseStatus;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Unit = {
  id: string;
  name: string;
  abbreviation: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  category: string | null;
  category_detail?: Category | null;
  unit: string;
  unit_detail?: Unit;
  name: string;
  sku: string;
  description: string;
  is_active: boolean;
  low_stock_threshold: string | null;
  default_cost: string | null;
  created_at: string;
  updated_at: string;
};

export type StockLevel = {
  id: string;
  product: string;
  product_sku: string;
  product_name: string;
  warehouse: string;
  warehouse_code: string;
  warehouse_name: string;
  location: string;
  location_code: string;
  location_name: string;
  quantity: string;
  created_at: string;
  updated_at: string;
};

export type StockMovement = {
  id: string;
  product: string;
  product_sku: string;
  product_name: string;
  movement_type: MovementType;
  quantity: string;
  source_warehouse: string | null;
  source_warehouse_code: string | null;
  source_location: string | null;
  source_location_code: string | null;
  destination_warehouse: string | null;
  destination_warehouse_code: string | null;
  destination_location: string | null;
  destination_location_code: string | null;
  reference_type: string;
  reference_id: string | null;
  transfer_batch_id: string | null;
  reason: string;
  notes: string;
  metadata: Record<string, unknown>;
  performed_by: string;
  performed_by_email: string;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DashboardSummary = {
  total_products: number;
  active_products: number;
  total_warehouses: number;
  active_warehouses: number;
  low_stock_products: number;
  total_stock_quantity: string;
  recent_movements_count: number;
};

export type LowStockProduct = {
  id: string;
  sku: string;
  name: string;
  low_stock_threshold: string;
  total_stock: string;
};

export type InventoryByWarehouse = {
  warehouse: string;
  warehouse_code: string;
  warehouse_name: string;
  status: WarehouseStatus;
  total_stock_quantity: string;
  product_count: number;
  location_count: number;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type BusinessError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type Session = {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
};

export type InviteAcceptanceStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "cancelled"
  | "invalid"
  | "wrong_email"
  | "already_member";

export type InviteAcceptancePreview = {
  status: InviteAcceptanceStatus;
  can_accept: boolean;
  message: string;
  email?: string;
  role?: Exclude<WorkspaceRole, "owner">;
  expires_at?: string;
};
