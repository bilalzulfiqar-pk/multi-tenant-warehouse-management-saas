"use client";

import { useState } from "react";

import { MovementBadge } from "@/components/domain/badges";
import { PaginationControls } from "@/components/domain/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenantList } from "@/hooks/use-resource";
import type { MovementType, StockMovement } from "@/lib/types";
import { formatDateTime, formatQuantity } from "@/lib/utils";

const movementTypes: { label: string; value: MovementType }[] = [
  { label: "Stock In", value: "stock_in" },
  { label: "Stock Out", value: "stock_out" },
  { label: "Adjustment", value: "adjustment" },
  { label: "Transfer In", value: "transfer_in" },
  { label: "Transfer Out", value: "transfer_out" },
];

export default function StockMovementsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const movements = useTenantList<StockMovement>("stock-movements", "stock-movements", {
    page,
    search,
    movement_type: movementType,
    ordering: "-created_at",
  });

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        description="Immutable inventory ledger created by stock operations."
      />
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px]">
          <Input
            placeholder="Search product, SKU, reason, or reference"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
          <NativeSelect
            value={movementType}
            onChange={(event) => {
              setPage(1);
              setMovementType(event.target.value);
            }}
          >
            <option value="">All movement types</option>
            {movementTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </NativeSelect>
        </CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(movements.data?.results || []).map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>{formatDateTime(movement.created_at)}</TableCell>
                <TableCell><MovementBadge type={movement.movement_type} /></TableCell>
                <TableCell>
                  <p className="font-medium text-slate-950">{movement.product_name}</p>
                  <p className="text-xs text-slate-500">{movement.product_sku}</p>
                </TableCell>
                <TableCell className="text-right">{formatQuantity(movement.quantity)}</TableCell>
                <TableCell>{movement.source_warehouse_code || "-"} {movement.source_location_code ? `/ ${movement.source_location_code}` : ""}</TableCell>
                <TableCell>{movement.destination_warehouse_code || "-"} {movement.destination_location_code ? `/ ${movement.destination_location_code}` : ""}</TableCell>
                <TableCell>{movement.performed_by_email}</TableCell>
                <TableCell>{movement.reason || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls page={page} setPage={setPage} data={movements.data} />
      </Card>
    </div>
  );
}
