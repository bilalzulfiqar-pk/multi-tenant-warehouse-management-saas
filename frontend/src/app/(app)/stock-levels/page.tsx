"use client";

import { ArrowRightLeft, ClipboardCheck, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PaginationControls } from "@/components/domain/pagination";
import { TableSkeleton } from "@/components/layout/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { useTenantArray, useTenantList } from "@/hooks/use-resource";
import { canAdjustOrTransfer, canStockInOut } from "@/lib/permissions";
import type { StockLevel, Warehouse, WarehouseLocation } from "@/lib/types";
import { formatDateTime, formatQuantity } from "@/lib/utils";

export default function StockLevelsPage() {
  const { data: session } = useSession();
  const role = session?.workspace?.role;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [location, setLocation] = useState("");
  const warehouses = useTenantArray<Warehouse>("warehouse-options", "warehouses");
  const locations = useTenantArray<WarehouseLocation>("location-options", "locations");
  const stockLevels = useTenantList<StockLevel>("stock-levels", "stock-levels", {
    page,
    search,
    warehouse,
    location,
    ordering: "product__sku",
  });

  return (
    <div>
      <PageHeader
        title="Stock Levels"
        description="Read-only current stock by product, warehouse, and location."
        actions={
          <>
            {canStockInOut(role) ? (
              <>
                <Button asChild variant="success"><Link href="/inventory-actions?mode=stock-in"><Plus className="h-4 w-4" />Stock In</Link></Button>
                <Button asChild variant="outline"><Link href="/inventory-actions?mode=stock-out"><Minus className="h-4 w-4" />Stock Out</Link></Button>
              </>
            ) : null}
            {canAdjustOrTransfer(role) ? (
              <>
                <Button asChild variant="outline"><Link href="/inventory-actions?mode=adjust"><ClipboardCheck className="h-4 w-4" />Adjust</Link></Button>
                <Button asChild variant="outline"><Link href="/inventory-actions?mode=transfer"><ArrowRightLeft className="h-4 w-4" />Transfer</Link></Button>
              </>
            ) : null}
          </>
        }
      />

      <Alert className="mb-4">
        Stock quantities are updated only through inventory operations. Direct quantity editing is intentionally unavailable.
      </Alert>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_220px]">
          <Input
            placeholder="Search SKU, product, warehouse, or location"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
          <NativeSelect value={warehouse} onChange={(event) => { setPage(1); setWarehouse(event.target.value); }}>
            <option value="">All warehouses</option>
            {(warehouses.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </NativeSelect>
          <NativeSelect value={location} onChange={(event) => { setPage(1); setLocation(event.target.value); }}>
            <option value="">All locations</option>
            {(locations.data || []).filter((item) => !warehouse || item.warehouse === warehouse).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
          </NativeSelect>
        </CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockLevels.isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <TableSkeleton columns={7} />
                </TableCell>
              </TableRow>
            ) : (stockLevels.data?.results || []).map((level) => (
              <TableRow key={level.id}>
                <TableCell className="font-medium text-slate-950">{level.product_sku}</TableCell>
                <TableCell>{level.product_name}</TableCell>
                <TableCell>{level.warehouse_code} - {level.warehouse_name}</TableCell>
                <TableCell>{level.location_code} - {level.location_name}</TableCell>
                <TableCell className="text-right font-semibold">{formatQuantity(level.quantity)}</TableCell>
                <TableCell>{formatDateTime(level.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canStockInOut(role) ? (
                      <>
                        <Button size="sm" variant="ghost" asChild><Link href={`/inventory-actions?mode=stock-in&product=${level.product}&warehouse=${level.warehouse}&location=${level.location}`}>In</Link></Button>
                        <Button size="sm" variant="ghost" asChild><Link href={`/inventory-actions?mode=stock-out&product=${level.product}&warehouse=${level.warehouse}&location=${level.location}`}>Out</Link></Button>
                      </>
                    ) : null}
                    {canAdjustOrTransfer(role) ? (
                      <>
                        <Button size="sm" variant="ghost" asChild><Link href={`/inventory-actions?mode=adjust&product=${level.product}&warehouse=${level.warehouse}&location=${level.location}`}>Adjust</Link></Button>
                        <Button size="sm" variant="ghost" asChild><Link href={`/inventory-actions?mode=transfer&product=${level.product}&source_warehouse=${level.warehouse}&source_location=${level.location}`}>Transfer</Link></Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls page={page} setPage={setPage} data={stockLevels.data} />
      </Card>
    </div>
  );
}
