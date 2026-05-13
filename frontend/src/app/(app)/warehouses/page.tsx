"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Edit, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/domain/confirm-action";
import { StatusBadge } from "@/components/domain/badges";
import { Field } from "@/components/domain/field";
import { MobileDataCard, MobileDataField } from "@/components/domain/mobile-data-card";
import { PaginationControls } from "@/components/domain/pagination";
import { TableEmptyRow, TableErrorRow } from "@/components/domain/table-state";
import { TableSkeleton } from "@/components/layout/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { createTenantResource, patchTenantResource, postTenantAction, useTenantArray, useTenantList } from "@/hooks/use-resource";
import { canManageSetup } from "@/lib/permissions";
import type { Warehouse, WarehouseLocation } from "@/lib/types";
import { formatDateTime, titleCase } from "@/lib/utils";

type WarehouseFormState = Partial<Warehouse>;
type LocationFormState = Partial<WarehouseLocation>;

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canManage = canManageSetup(session?.workspace?.role);
  const [warehousePage, setWarehousePage] = useState(1);
  const [locationPage, setLocationPage] = useState(1);
  const [search, setSearch] = useState("");
  const warehouses = useTenantList<Warehouse>("warehouses", "warehouses", {
    page: warehousePage,
    search,
    status: "all",
  });
  const locations = useTenantList<WarehouseLocation>("locations", "locations", {
    page: locationPage,
    search,
    status: "all",
  });
  const warehouseOptions = useTenantArray<Warehouse>("warehouse-options", "warehouses");
  const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState | null>(null);
  const [locationForm, setLocationForm] = useState<LocationFormState | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["tenant"] });
  }

  async function submitWarehouse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      code: form.get("code"),
      address_line1: form.get("address_line1") || "",
      address_line2: form.get("address_line2") || "",
      city: form.get("city") || "",
      country: form.get("country") || "",
    };
    try {
      if (warehouseForm?.id) {
        await patchTenantResource(`warehouses/${warehouseForm.id}`, payload);
      } else {
        await createTenantResource("warehouses", payload);
      }
      setWarehouseForm(null);
      toast.success("Warehouse saved");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save warehouse");
    }
  }

  async function submitLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      warehouse: form.get("warehouse"),
      name: form.get("name"),
      code: form.get("code"),
      location_type: form.get("location_type"),
    };
    try {
      if (locationForm?.id) {
        await patchTenantResource(`locations/${locationForm.id}`, payload);
      } else {
        await createTenantResource("locations", payload);
      }
      setLocationForm(null);
      toast.success("Location saved");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save location");
    }
  }

  async function toggle(path: string, status: string) {
    try {
      await postTenantAction(`${path}/${status === "active" ? "deactivate" : "activate"}`);
      toast.success(status === "active" ? "Deactivated" : "Activated");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Warehouses"
        description="Manage physical warehouse structures and simple storage locations."
        actions={
          canManage ? (
            <>
              <Button onClick={() => setWarehouseForm({})}>+ Warehouse</Button>
              <Button variant="outline" onClick={() => setLocationForm({})}>+ Location</Button>
            </>
          ) : null
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <Input
            placeholder="Search warehouses or locations"
            value={search}
            onChange={(event) => {
              setWarehousePage(1);
              setLocationPage(1);
              setSearch(event.target.value);
            }}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="warehouses">
        <TabsList>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses">
          <Card>
            <div className="space-y-3 p-4 md:hidden">
              {warehouses.isLoading ? (
                <TableSkeleton columns={2} rows={4} />
              ) : warehouses.isError ? (
                <div className="rounded-lg border bg-white">
                  <table className="w-full">
                    <tbody>
                      <TableErrorRow colSpan={1} onRetry={() => warehouses.refetch()} />
                    </tbody>
                  </table>
                </div>
              ) : (warehouses.data?.results || []).length === 0 ? (
                <div className="rounded-lg border bg-white">
                  <table className="w-full">
                    <tbody>
                      <TableEmptyRow
                        colSpan={1}
                        title="No warehouses found"
                        description="Create a warehouse or adjust the current search."
                      />
                    </tbody>
                  </table>
                </div>
              ) : (warehouses.data?.results || []).map((warehouse) => (
                <MobileDataCard
                  key={warehouse.id}
                  title={warehouse.name}
                  subtitle={warehouse.code}
                  badge={<StatusBadge value={warehouse.status} />}
                  actions={
                    canManage ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setWarehouseForm(warehouse)}>
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <ConfirmAction
                          title={warehouse.status === "active" ? "Deactivate warehouse?" : "Reactivate warehouse?"}
                          description={
                            warehouse.status === "active"
                              ? "This warehouse will be blocked from new stock operations."
                              : "This warehouse can be used in new stock operations again."
                          }
                          confirmLabel={warehouse.status === "active" ? "Deactivate" : "Reactivate"}
                          variant={warehouse.status === "active" ? "danger" : "default"}
                          onConfirm={() => toggle(`warehouses/${warehouse.id}`, warehouse.status)}
                        >
                          <Button variant="ghost" size="sm">
                            {warehouse.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            {warehouse.status === "active" ? "Deactivate" : "Reactivate"}
                          </Button>
                        </ConfirmAction>
                      </>
                    ) : null
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MobileDataField
                      label="City / Country"
                      value={[warehouse.city, warehouse.country].filter(Boolean).join(", ") || "-"}
                    />
                    <MobileDataField label="Updated" value={formatDateTime(warehouse.updated_at)} />
                  </div>
                </MobileDataCard>
              ))}
            </div>
            <div className="hidden md:block">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>City / Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <TableSkeleton columns={6} />
                      </TableCell>
                    </TableRow>
                  ) : warehouses.isError ? (
                    <TableErrorRow colSpan={6} onRetry={() => warehouses.refetch()} />
                  ) : (warehouses.data?.results || []).length === 0 ? (
                    <TableEmptyRow
                      colSpan={6}
                      title="No warehouses found"
                      description="Create a warehouse or adjust the current search."
                    />
                  ) : (warehouses.data?.results || []).map((warehouse) => (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium text-slate-950">{warehouse.code}</TableCell>
                      <TableCell>{warehouse.name}</TableCell>
                      <TableCell>{[warehouse.city, warehouse.country].filter(Boolean).join(", ") || "-"}</TableCell>
                      <TableCell><StatusBadge value={warehouse.status} /></TableCell>
                      <TableCell>{formatDateTime(warehouse.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        {canManage ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setWarehouseForm(warehouse)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <ConfirmAction
                              title={warehouse.status === "active" ? "Deactivate warehouse?" : "Reactivate warehouse?"}
                              description={
                                warehouse.status === "active"
                                  ? "This warehouse will be blocked from new stock operations."
                                  : "This warehouse can be used in new stock operations again."
                              }
                              confirmLabel={warehouse.status === "active" ? "Deactivate" : "Reactivate"}
                              variant={warehouse.status === "active" ? "danger" : "default"}
                              onConfirm={() => toggle(`warehouses/${warehouse.id}`, warehouse.status)}
                            >
                              <Button variant="ghost" size="icon">
                                {warehouse.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </Button>
                            </ConfirmAction>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationControls page={warehousePage} setPage={setWarehousePage} data={warehouses.data} />
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card>
            <div className="space-y-3 p-4 md:hidden">
              {locations.isLoading ? (
                <TableSkeleton columns={2} rows={4} />
              ) : locations.isError ? (
                <div className="rounded-lg border bg-white">
                  <table className="w-full">
                    <tbody>
                      <TableErrorRow colSpan={1} onRetry={() => locations.refetch()} />
                    </tbody>
                  </table>
                </div>
              ) : (locations.data?.results || []).length === 0 ? (
                <div className="rounded-lg border bg-white">
                  <table className="w-full">
                    <tbody>
                      <TableEmptyRow
                        colSpan={1}
                        title="No locations found"
                        description="Create a location or adjust the current search."
                      />
                    </tbody>
                  </table>
                </div>
              ) : (locations.data?.results || []).map((location) => (
                <MobileDataCard
                  key={location.id}
                  title={location.name}
                  subtitle={location.code}
                  badge={<StatusBadge value={location.status} />}
                  actions={
                    canManage ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setLocationForm(location)}>
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <ConfirmAction
                          title={location.status === "active" ? "Deactivate location?" : "Reactivate location?"}
                          description={
                            location.status === "active"
                              ? "This location will be blocked from new stock operations."
                              : "This location can be used in new stock operations again."
                          }
                          confirmLabel={location.status === "active" ? "Deactivate" : "Reactivate"}
                          variant={location.status === "active" ? "danger" : "default"}
                          onConfirm={() => toggle(`locations/${location.id}`, location.status)}
                        >
                          <Button variant="ghost" size="sm">
                            {location.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            {location.status === "active" ? "Deactivate" : "Reactivate"}
                          </Button>
                        </ConfirmAction>
                      </>
                    ) : null
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MobileDataField label="Warehouse" value={location.warehouse_detail?.name || "-"} />
                    <MobileDataField label="Type" value={titleCase(location.location_type)} />
                    <MobileDataField label="Updated" value={formatDateTime(location.updated_at)} />
                  </div>
                </MobileDataCard>
              ))}
            </div>
            <div className="hidden md:block">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <TableSkeleton columns={7} />
                    </TableCell>
                  </TableRow>
                ) : locations.isError ? (
                  <TableErrorRow colSpan={7} onRetry={() => locations.refetch()} />
                ) : (locations.data?.results || []).length === 0 ? (
                  <TableEmptyRow
                    colSpan={7}
                    title="No locations found"
                    description="Create a location or adjust the current search."
                  />
                ) : (locations.data?.results || []).map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium text-slate-950">{location.code}</TableCell>
                    <TableCell>{location.name}</TableCell>
                    <TableCell>{location.warehouse_detail?.name || "-"}</TableCell>
                    <TableCell>{titleCase(location.location_type)}</TableCell>
                    <TableCell><StatusBadge value={location.status} /></TableCell>
                    <TableCell>{formatDateTime(location.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setLocationForm(location)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <ConfirmAction
                            title={location.status === "active" ? "Deactivate location?" : "Reactivate location?"}
                            description={
                              location.status === "active"
                                ? "This location will be blocked from new stock operations."
                                : "This location can be used in new stock operations again."
                            }
                            confirmLabel={location.status === "active" ? "Deactivate" : "Reactivate"}
                            variant={location.status === "active" ? "danger" : "default"}
                            onConfirm={() => toggle(`locations/${location.id}`, location.status)}
                          >
                            <Button variant="ghost" size="icon">
                              {location.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                          </ConfirmAction>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <PaginationControls page={locationPage} setPage={setLocationPage} data={locations.data} />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={warehouseForm !== null} onOpenChange={(open) => !open && setWarehouseForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{warehouseForm?.id ? "Edit warehouse" : "Create warehouse"}</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={submitWarehouse}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name"><Input name="name" defaultValue={warehouseForm?.name || ""} required /></Field>
              <Field label="Code"><Input name="code" defaultValue={warehouseForm?.code || ""} required /></Field>
            </div>
            <Field label="Address line 1"><Input name="address_line1" defaultValue={warehouseForm?.address_line1 || ""} /></Field>
            <Field label="Address line 2"><Input name="address_line2" defaultValue={warehouseForm?.address_line2 || ""} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="City"><Input name="city" defaultValue={warehouseForm?.city || ""} /></Field>
              <Field label="Country"><Input name="country" defaultValue={warehouseForm?.country || ""} /></Field>
            </div>
            <Button className="w-full sm:w-auto" type="submit">Save warehouse</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={locationForm !== null} onOpenChange={(open) => !open && setLocationForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{locationForm?.id ? "Edit location" : "Create location"}</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={submitLocation}>
            <Field label="Warehouse">
              <NativeSelect name="warehouse" defaultValue={locationForm?.warehouse || ""} required>
                <option value="">Select warehouse</option>
                {(warehouseOptions.data || []).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name"><Input name="name" defaultValue={locationForm?.name || ""} required /></Field>
              <Field label="Code"><Input name="code" defaultValue={locationForm?.code || ""} required /></Field>
            </div>
            <Field label="Location type">
              <NativeSelect name="location_type" defaultValue={locationForm?.location_type || "storage"}>
                <option value="storage">Storage</option>
                <option value="adjustment">Adjustment</option>
                <option value="other">Other</option>
              </NativeSelect>
            </Field>
            <Button className="w-full sm:w-auto" type="submit">Save location</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
