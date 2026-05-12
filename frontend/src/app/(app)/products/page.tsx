"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Edit, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BooleanBadge } from "@/components/domain/badges";
import { ConfirmAction } from "@/components/domain/confirm-action";
import { Field } from "@/components/domain/field";
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
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { createTenantResource, patchTenantResource, postTenantAction, useTenantArray, useTenantList } from "@/hooks/use-resource";
import { canManageSetup } from "@/lib/permissions";
import type { Category, Product, Unit } from "@/lib/types";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/utils";

type ProductFormState = Partial<Product> & { unit?: string; category?: string | null };
type CategoryFormState = Partial<Category>;
type UnitFormState = Partial<Unit>;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canManage = canManageSetup(session?.workspace?.role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("true");
  const products = useTenantList<Product>("products", "products", {
    page,
    search,
    is_active: status,
    ordering: "name",
  });
  const categories = useTenantArray<Category>("categories", "categories");
  const units = useTenantArray<Unit>("units", "units");
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(null);
  const [unitForm, setUnitForm] = useState<UnitFormState | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["tenant"] });
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      sku: form.get("sku"),
      category: form.get("category") || null,
      unit: form.get("unit"),
      description: form.get("description") || "",
      low_stock_threshold: form.get("low_stock_threshold") || null,
      default_cost: form.get("default_cost") || null,
    };
    try {
      if (productForm?.id) {
        await patchTenantResource(`products/${productForm.id}`, payload);
      } else {
        await createTenantResource("products", payload);
      }
      setProductForm(null);
      toast.success("Product saved");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save product");
    }
  }

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), description: form.get("description") || "" };
    try {
      if (categoryForm?.id) {
        await patchTenantResource(`categories/${categoryForm.id}`, payload);
      } else {
        await createTenantResource("categories", payload);
      }
      setCategoryForm(null);
      toast.success("Category saved");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save category");
    }
  }

  async function submitUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), abbreviation: form.get("abbreviation") };
    try {
      if (unitForm?.id) {
        await patchTenantResource(`units/${unitForm.id}`, payload);
      } else {
        await createTenantResource("units", payload);
      }
      setUnitForm(null);
      toast.success("Unit saved");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save unit");
    }
  }

  async function toggle(path: string, active: boolean) {
    try {
      await postTenantAction(`${path}/${active ? "deactivate" : "activate"}`);
      toast.success(active ? "Deactivated" : "Activated");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage tenant-owned SKUs, categories, and units used by inventory operations."
        actions={
          canManage ? (
            <>
              <Button onClick={() => setProductForm({})}>+ Product</Button>
              <Button variant="outline" onClick={() => setCategoryForm({})}>+ Category</Button>
              <Button variant="outline" onClick={() => setUnitForm({})}>+ Unit</Button>
            </>
          ) : null
        }
      />

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products / SKUs</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <Input
                  placeholder="Search by SKU, product, category, or unit"
                  value={search}
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                />
                <NativeSelect value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                  <option value="all">All statuses</option>
                </NativeSelect>
              </div>
            </CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Low stock</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <TableSkeleton columns={9} />
                    </TableCell>
                  </TableRow>
                ) : products.isError ? (
                  <TableErrorRow colSpan={9} onRetry={() => products.refetch()} />
                ) : (products.data?.results || []).length === 0 ? (
                  <TableEmptyRow
                    colSpan={9}
                    title="No products found"
                    description="Create a product or adjust the current filters."
                  />
                ) : (products.data?.results || []).map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium text-slate-950">{product.sku}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.category_detail?.name || "-"}</TableCell>
                    <TableCell>{product.unit_detail?.abbreviation || "-"}</TableCell>
                    <TableCell className="text-right">
                      {product.low_stock_threshold ? formatQuantity(product.low_stock_threshold) : "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(product.default_cost)}</TableCell>
                    <TableCell><BooleanBadge active={product.is_active} /></TableCell>
                    <TableCell>{formatDateTime(product.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setProductForm(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <ConfirmAction
                            title={product.is_active ? "Deactivate product?" : "Reactivate product?"}
                            description={
                              product.is_active
                                ? "This product will be blocked from new stock operations."
                                : "This product can be used in new stock operations again."
                            }
                            confirmLabel={product.is_active ? "Deactivate" : "Reactivate"}
                            variant={product.is_active ? "danger" : "default"}
                            onConfirm={() => toggle(`products/${product.id}`, product.is_active)}
                          >
                            <Button variant="ghost" size="icon">
                              {product.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                          </ConfirmAction>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls page={page} setPage={setPage} data={products.data} />
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <SimpleTable
            rows={categories.data || []}
            isLoading={categories.isLoading}
            isError={categories.isError}
            onRetry={() => categories.refetch()}
            emptyTitle="No categories found"
            columns={["Name", "Description", "Status"]}
            render={(category) => [
              category.name,
              category.description || "-",
              <BooleanBadge key="status" active={category.is_active} />,
            ]}
            actions={(category) =>
              canManage ? (
                <>
                  <Button variant="ghost" size="icon" onClick={() => setCategoryForm(category)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <ConfirmAction
                    title={category.is_active ? "Deactivate category?" : "Reactivate category?"}
                    description="This changes whether the category is available for catalog organization."
                    confirmLabel={category.is_active ? "Deactivate" : "Reactivate"}
                    variant={category.is_active ? "danger" : "default"}
                    onConfirm={() => toggle(`categories/${category.id}`, category.is_active)}
                  >
                    <Button variant="ghost" size="icon">
                      {category.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  </ConfirmAction>
                </>
              ) : null
            }
          />
        </TabsContent>

        <TabsContent value="units">
          <SimpleTable
            rows={units.data || []}
            isLoading={units.isLoading}
            isError={units.isError}
            onRetry={() => units.refetch()}
            emptyTitle="No units found"
            columns={["Name", "Abbreviation", "Status"]}
            render={(unit) => [
              unit.name,
              unit.abbreviation,
              <BooleanBadge key="status" active={unit.is_active} />,
            ]}
            actions={(unit) =>
              canManage ? (
                <>
                  <Button variant="ghost" size="icon" onClick={() => setUnitForm(unit)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <ConfirmAction
                    title={unit.is_active ? "Deactivate unit?" : "Reactivate unit?"}
                    description="This changes whether the unit is available for new products."
                    confirmLabel={unit.is_active ? "Deactivate" : "Reactivate"}
                    variant={unit.is_active ? "danger" : "default"}
                    onConfirm={() => toggle(`units/${unit.id}`, unit.is_active)}
                  >
                    <Button variant="ghost" size="icon">
                      {unit.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  </ConfirmAction>
                </>
              ) : null
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={productForm !== null} onOpenChange={(open) => !open && setProductForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{productForm?.id ? "Edit product" : "Create product"}</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={submitProduct}>
            <Field label="Product name"><Input name="name" defaultValue={productForm?.name || ""} required /></Field>
            <Field label="SKU"><Input name="sku" defaultValue={productForm?.sku || ""} required /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Category">
                <NativeSelect name="category" defaultValue={productForm?.category || ""}>
                  <option value="">No category</option>
                  {(categories.data || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Unit">
                <NativeSelect name="unit" defaultValue={productForm?.unit || ""} required>
                  <option value="">Select unit</option>
                  {(units.data || []).map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Description"><Textarea name="description" defaultValue={productForm?.description || ""} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Low stock threshold"><Input name="low_stock_threshold" defaultValue={productForm?.low_stock_threshold || ""} placeholder="10.000" /></Field>
              <Field label="Default cost"><Input name="default_cost" defaultValue={productForm?.default_cost || ""} placeholder="15.25" /></Field>
            </div>
            <Button type="submit">Save product</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryForm !== null} onOpenChange={(open) => !open && setCategoryForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{categoryForm?.id ? "Edit category" : "Create category"}</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={submitCategory}>
            <Field label="Name"><Input name="name" defaultValue={categoryForm?.name || ""} required /></Field>
            <Field label="Description"><Textarea name="description" defaultValue={categoryForm?.description || ""} /></Field>
            <Button type="submit">Save category</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={unitForm !== null} onOpenChange={(open) => !open && setUnitForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{unitForm?.id ? "Edit unit" : "Create unit"}</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={submitUnit}>
            <Field label="Name"><Input name="name" defaultValue={unitForm?.name || ""} required /></Field>
            <Field label="Abbreviation"><Input name="abbreviation" defaultValue={unitForm?.abbreviation || ""} required /></Field>
            <Button type="submit">Save unit</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SimpleTable<T extends { id: string }>({
  rows,
  isLoading,
  isError,
  onRetry,
  emptyTitle,
  columns,
  render,
  actions,
}: {
  rows: T[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyTitle: string;
  columns: string[];
  render: (row: T) => React.ReactNode[];
  actions?: (row: T) => React.ReactNode;
}) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1}>
                <TableSkeleton columns={columns.length + 1} />
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableErrorRow colSpan={columns.length + 1} onRetry={onRetry} />
          ) : rows.length === 0 ? (
            <TableEmptyRow
              colSpan={columns.length + 1}
              title={emptyTitle}
              description="Create one to start organizing catalog data."
            />
          ) : rows.map((row) => (
            <TableRow key={row.id}>
              {render(row).map((cell, index) => <TableCell key={index}>{cell}</TableCell>)}
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">{actions?.(row)}</div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
