"use client";

import { Activity, Boxes, Building2, Package, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { MovementBadge, StatusBadge } from "@/components/domain/badges";
import { TableEmptyRow, TableErrorRow } from "@/components/domain/table-state";
import { EmptyState } from "@/components/layout/empty-state";
import { StatCardsSkeleton, TableSkeleton } from "@/components/layout/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { tenantApi } from "@/lib/api-client";
import type {
  DashboardSummary,
  InventoryByWarehouse,
  LowStockProduct,
  StockMovement,
} from "@/lib/types";
import { formatDateTime, formatQuantity } from "@/lib/utils";

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const session = useSession();
  const hasWorkspace = Boolean(session.data?.workspace);
  const tenantScope = [
    session.data?.user?.id || "anonymous",
    session.data?.workspace?.subdomain || "none",
  ];
  const summary = useQuery({
    queryKey: ["tenant", ...tenantScope, "dashboard-summary"],
    enabled: hasWorkspace,
    queryFn: () => tenantApi<DashboardSummary>("dashboard/summary"),
  });
  const lowStock = useQuery({
    queryKey: ["tenant", ...tenantScope, "dashboard-low-stock"],
    enabled: hasWorkspace,
    queryFn: () => tenantApi<LowStockProduct[]>("dashboard/low-stock"),
  });
  const byWarehouse = useQuery({
    queryKey: ["tenant", ...tenantScope, "dashboard-by-warehouse"],
    enabled: hasWorkspace,
    queryFn: () => tenantApi<InventoryByWarehouse[]>("dashboard/inventory-by-warehouse"),
  });
  const recent = useQuery({
    queryKey: ["tenant", ...tenantScope, "dashboard-recent"],
    enabled: hasWorkspace,
    queryFn: () => tenantApi<StockMovement[]>("dashboard/recent-movements"),
  });
  const dashboardLoading =
    summary.isLoading || lowStock.isLoading || byWarehouse.isLoading || recent.isLoading;

  if (!hasWorkspace) {
    return (
      <EmptyState
        title="No workspace selected"
        description="Create or select a workspace before viewing tenant-scoped dashboard data."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Tenant-scoped operating snapshot for inventory and warehouse health."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/products">+ Product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/warehouses">+ Warehouse</Link>
            </Button>
            <Button asChild>
              <Link href="/inventory-actions">Inventory Actions</Link>
            </Button>
          </>
        }
      />

      {dashboardLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Products"
            value={summary.data?.total_products ?? "-"}
            icon={Package}
          />
          <StatCard
            title="Warehouses"
            value={summary.data?.total_warehouses ?? "-"}
            icon={Building2}
          />
          <StatCard
            title="Low Stock"
            value={summary.data?.low_stock_products ?? "-"}
            icon={TriangleAlert}
          />
          <StatCard
            title="Total Stock"
            value={summary.data ? formatQuantity(summary.data.total_stock_quantity) : "-"}
            icon={Boxes}
          />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inventory by warehouse</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Total stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byWarehouse.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <TableSkeleton columns={4} />
                    </TableCell>
                  </TableRow>
                ) : byWarehouse.isError ? (
                  <TableErrorRow colSpan={4} onRetry={() => byWarehouse.refetch()} />
                ) : (byWarehouse.data || []).length === 0 ? (
                  <TableEmptyRow
                    colSpan={4}
                    title="No warehouse inventory yet"
                    description="Stock quantities will appear after inventory operations."
                  />
                ) : (byWarehouse.data || []).map((item) => (
                  <TableRow key={item.warehouse}>
                    <TableCell>
                      <p className="font-medium text-slate-950">{item.warehouse_name}</p>
                      <p className="text-xs text-slate-500">{item.warehouse_code}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={item.status} />
                    </TableCell>
                    <TableCell className="text-right">{item.product_count}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatQuantity(item.total_stock_quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low stock products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <TableSkeleton columns={4} />
                    </TableCell>
                  </TableRow>
                ) : lowStock.isError ? (
                  <TableErrorRow colSpan={4} onRetry={() => lowStock.refetch()} />
                ) : (lowStock.data || []).length === 0 ? (
                  <TableEmptyRow
                    colSpan={4}
                    title="No low stock products"
                    description="Products below their thresholds will appear here."
                  />
                ) : (lowStock.data || []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-slate-950">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{formatQuantity(item.total_stock)}</TableCell>
                    <TableCell className="text-right">
                      {formatQuantity(item.low_stock_threshold)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Recent movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Performed by</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <TableSkeleton columns={5} />
                  </TableCell>
                </TableRow>
              ) : recent.isError ? (
                <TableErrorRow colSpan={5} onRetry={() => recent.refetch()} />
              ) : (recent.data || []).length === 0 ? (
                <TableEmptyRow
                  colSpan={5}
                  title="No recent movements"
                  description="Stock actions will create movement records here."
                />
              ) : (recent.data || []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <MovementBadge type={item.movement_type} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-950">{item.product_name}</p>
                    <p className="text-xs text-slate-500">{item.product_sku}</p>
                  </TableCell>
                  <TableCell className="text-right">{formatQuantity(item.quantity)}</TableCell>
                  <TableCell>{item.performed_by_email}</TableCell>
                  <TableCell>{formatDateTime(item.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t p-4">
            <Button asChild variant="outline">
              <Link href="/stock-movements">
                <Activity className="h-4 w-4" />
                View ledger
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
