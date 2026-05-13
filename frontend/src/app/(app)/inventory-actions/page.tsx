"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, ClipboardCheck, Minus, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/domain/field";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { useTenantArray } from "@/hooks/use-resource";
import { jsonBody, tenantApi } from "@/lib/api-client";
import { canAdjustOrTransfer, canStockInOut } from "@/lib/permissions";
import type { Paginated, Product, StockLevel, Warehouse, WarehouseLocation, WorkspaceRole } from "@/lib/types";
import { formatQuantity } from "@/lib/utils";

type Mode = "stock-in" | "stock-out" | "adjust" | "transfer";

const inventoryModes: {
  value: Mode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowed: (role?: WorkspaceRole | null) => boolean;
}[] = [
  { value: "stock-in", label: "Stock In", icon: Plus, allowed: canStockInOut },
  { value: "stock-out", label: "Stock Out", icon: Minus, allowed: canStockInOut },
  { value: "adjust", label: "Adjust", icon: ClipboardCheck, allowed: canAdjustOrTransfer },
  { value: "transfer", label: "Transfer", icon: ArrowRightLeft, allowed: canAdjustOrTransfer },
];

export default function InventoryActionsPage() {
  return (
    <Suspense fallback={null}>
      <InventoryActionsPageContent />
    </Suspense>
  );
}

function InventoryActionsPageContent() {
  const params = useSearchParams();
  const initialMode = (params.get("mode") as Mode) || "stock-in";
  const [mode, setMode] = useState<Mode>(initialMode);
  const { data: session } = useSession();
  const role = session?.workspace?.role;
  const availableModes = inventoryModes.filter((item) => item.allowed(role));
  const activeMode = availableModes.some((item) => item.value === mode)
    ? mode
    : availableModes[0]?.value;
  const isViewer = role === "viewer";

  return (
    <div>
      <PageHeader
        title="Inventory Actions"
        description="Perform transaction-safe stock operations. Stock levels and movement history are created by these workflows."
      />
      {isViewer ? (
        <EmptyState
          title="Inventory actions are not available for Viewer access"
          description="Viewer can review stock levels and movement history, but cannot perform stock operations."
        />
      ) : null}
      {!activeMode ? null : (
      <Tabs value={activeMode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="w-full sm:w-auto">
          {availableModes.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger key={item.value} value={item.value}>
                <Icon className="mr-2 inline h-4 w-4" />
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="stock-in"><StockInOutForm type="stock-in" /></TabsContent>
        <TabsContent value="stock-out"><StockInOutForm type="stock-out" /></TabsContent>
        <TabsContent value="adjust"><AdjustForm /></TabsContent>
        <TabsContent value="transfer"><TransferForm /></TabsContent>
      </Tabs>
      )}
    </div>
  );
}

function useInventoryOptions() {
  const { data: session } = useSession();
  const tenantScope = [
    session?.user?.id || "anonymous",
    session?.workspace?.subdomain || "none",
  ];
  const hasWorkspace = Boolean(session?.user && session?.workspace);
  const products = useTenantArray<Product>("product-options", "products");
  const warehouses = useTenantArray<Warehouse>("warehouse-options", "warehouses");
  const locations = useTenantArray<WarehouseLocation>("location-options", "locations");
  const stockLevels = useQuery({
    queryKey: ["tenant", ...tenantScope, "stock-levels", "all"],
    enabled: hasWorkspace,
    queryFn: async () => {
      const page = await tenantApi<Paginated<StockLevel>>("stock-levels", {
        query: { page_size: 100 },
      });
      return page.results;
    },
  });
  return { products, warehouses, locations, stockLevels };
}

function useDefaults() {
  const params = useSearchParams();
  return {
    product: params.get("product") || "",
    warehouse: params.get("warehouse") || "",
    location: params.get("location") || "",
    source_warehouse: params.get("source_warehouse") || "",
    source_location: params.get("source_location") || "",
  };
}

function availableQuantity(levels: StockLevel[] | undefined, product: string, warehouse: string, location: string) {
  return levels?.find(
    (level) => level.product === product && level.warehouse === warehouse && level.location === location,
  )?.quantity;
}

function StockInOutForm({ type }: { type: "stock-in" | "stock-out" }) {
  const queryClient = useQueryClient();
  const defaults = useDefaults();
  const { products, warehouses, locations, stockLevels } = useInventoryOptions();
  const [product, setProduct] = useState(defaults.product);
  const [warehouse, setWarehouse] = useState(defaults.warehouse);
  const [location, setLocation] = useState(defaults.location);
  const [loading, setLoading] = useState(false);
  const available = availableQuantity(stockLevels.data, product, warehouse, location);
  const optionsLoading = products.isLoading || warehouses.isLoading || locations.isLoading;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await tenantApi(`inventory/${type}`, {
        method: "POST",
        body: jsonBody({
          product,
          warehouse,
          location,
          quantity: form.get("quantity"),
          reason: form.get("reason") || "",
          notes: form.get("notes") || "",
        }),
      });
      toast.success(type === "stock-in" ? "Stock added" : "Stock removed");
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
      event.currentTarget.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inventory action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <InventoryFormCard title={type === "stock-in" ? "Add stock" : "Remove stock"}>
      {optionsLoading ? (
        <InventoryOptionsLoader />
      ) : (
      <form className="grid gap-4" onSubmit={submit}>
        <InventorySelectors
          products={products.data || []}
          warehouses={warehouses.data || []}
          locations={locations.data || []}
          product={product}
          warehouse={warehouse}
          location={location}
          setProduct={setProduct}
          setWarehouse={setWarehouse}
          setLocation={setLocation}
        />
        {type === "stock-out" ? (
          <Alert>Available quantity: {available ? formatQuantity(available) : "0.000"}</Alert>
        ) : null}
        <Field label="Quantity"><Input name="quantity" placeholder="5.000" required /></Field>
        <Field label="Reason"><Input name="reason" placeholder={type === "stock-in" ? "Initial stock" : "Operational removal"} /></Field>
        <Field label="Notes"><Textarea name="notes" /></Field>
        <Button className="w-full sm:w-auto" isLoading={loading} loadingText="Submitting..." type="submit">
          {type === "stock-in" ? "Add stock" : "Remove stock"}
        </Button>
      </form>
      )}
    </InventoryFormCard>
  );
}

function AdjustForm() {
  const queryClient = useQueryClient();
  const defaults = useDefaults();
  const { products, warehouses, locations, stockLevels } = useInventoryOptions();
  const [product, setProduct] = useState(defaults.product);
  const [warehouse, setWarehouse] = useState(defaults.warehouse);
  const [location, setLocation] = useState(defaults.location);
  const [loading, setLoading] = useState(false);
  const current = availableQuantity(stockLevels.data, product, warehouse, location);
  const optionsLoading = products.isLoading || warehouses.isLoading || locations.isLoading;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await tenantApi("inventory/adjust", {
        method: "POST",
        body: jsonBody({
          product,
          warehouse,
          location,
          counted_quantity: form.get("counted_quantity"),
          reason: form.get("reason"),
          notes: form.get("notes") || "",
        }),
      });
      toast.success("Stock adjusted");
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Adjustment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <InventoryFormCard title="Set stock to physical count">
      {optionsLoading ? (
        <InventoryOptionsLoader />
      ) : (
      <form className="grid gap-4" onSubmit={submit}>
        <InventorySelectors
          products={products.data || []}
          warehouses={warehouses.data || []}
          locations={locations.data || []}
          product={product}
          warehouse={warehouse}
          location={location}
          setProduct={setProduct}
          setWarehouse={setWarehouse}
          setLocation={setLocation}
        />
        <Alert>Current system quantity: {current ? formatQuantity(current) : "0.000"}</Alert>
        <Field label="Counted quantity" hint="Adjustment sets stock to the physical count."><Input name="counted_quantity" placeholder="20.000" required /></Field>
        <Field label="Reason"><Input name="reason" placeholder="Physical count correction" required /></Field>
        <Field label="Notes"><Textarea name="notes" /></Field>
        <Button className="w-full sm:w-auto" isLoading={loading} loadingText="Submitting..." type="submit">Set counted quantity</Button>
      </form>
      )}
    </InventoryFormCard>
  );
}

function TransferForm() {
  const queryClient = useQueryClient();
  const defaults = useDefaults();
  const { products, warehouses, locations, stockLevels } = useInventoryOptions();
  const [product, setProduct] = useState(defaults.product);
  const [sourceWarehouse, setSourceWarehouse] = useState(defaults.source_warehouse);
  const [sourceLocation, setSourceLocation] = useState(defaults.source_location);
  const [destinationWarehouse, setDestinationWarehouse] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const available = availableQuantity(stockLevels.data, product, sourceWarehouse, sourceLocation);
  const selectedProduct = products.data?.find((item) => item.id === product);
  const source = locations.data?.find((item) => item.id === sourceLocation);
  const destination = locations.data?.find((item) => item.id === destinationLocation);
  const optionsLoading = products.isLoading || warehouses.isLoading || locations.isLoading;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await tenantApi("inventory/transfer", {
        method: "POST",
        body: jsonBody({
          product,
          source_warehouse: sourceWarehouse,
          source_location: sourceLocation,
          destination_warehouse: destinationWarehouse,
          destination_location: destinationLocation,
          quantity: form.get("quantity"),
          reason: form.get("reason") || "",
          notes: form.get("notes") || "",
        }),
      });
      toast.success("Stock transferred");
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <InventoryFormCard title="Transfer stock between locations">
      {optionsLoading ? (
        <InventoryOptionsLoader />
      ) : (
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Product">
          <NativeSelect value={product} onChange={(event) => setProduct(event.target.value)} required>
            <option value="">Select product</option>
            {(products.data || []).map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}
          </NativeSelect>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <LocationPair
            label="Source"
            warehouses={warehouses.data || []}
            locations={locations.data || []}
            warehouse={sourceWarehouse}
            location={sourceLocation}
            setWarehouse={setSourceWarehouse}
            setLocation={setSourceLocation}
          />
          <LocationPair
            label="Destination"
            warehouses={warehouses.data || []}
            locations={locations.data || []}
            warehouse={destinationWarehouse}
            location={destinationLocation}
            setWarehouse={setDestinationWarehouse}
            setLocation={setDestinationLocation}
          />
        </div>
        <Alert>
          Transfer {selectedProduct ? selectedProduct.sku : "selected product"} from {source?.code || "source"} to {destination?.code || "destination"}. Available: {available ? formatQuantity(available) : "0.000"}.
        </Alert>
        <Field label="Quantity"><Input name="quantity" placeholder="5.000" required /></Field>
        <Field label="Reason"><Input name="reason" placeholder="Move to another location" /></Field>
        <Field label="Notes"><Textarea name="notes" /></Field>
        <Button className="w-full sm:w-auto" isLoading={loading} loadingText="Submitting..." type="submit">Transfer stock</Button>
      </form>
      )}
    </InventoryFormCard>
  );
}

function InventoryFormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InventoryOptionsLoader() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading inventory form options">
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-9 w-36" />
    </div>
  );
}

function InventorySelectors({
  products,
  warehouses,
  locations,
  product,
  warehouse,
  location,
  setProduct,
  setWarehouse,
  setLocation,
}: {
  products: Product[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  product: string;
  warehouse: string;
  location: string;
  setProduct: (value: string) => void;
  setWarehouse: (value: string) => void;
  setLocation: (value: string) => void;
}) {
  return (
    <>
      <Field label="Product">
        <NativeSelect value={product} onChange={(event) => setProduct(event.target.value)} required>
          <option value="">Select product</option>
          {products.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}
        </NativeSelect>
      </Field>
      <LocationPair
        label="Location"
        warehouses={warehouses}
        locations={locations}
        warehouse={warehouse}
        location={location}
        setWarehouse={setWarehouse}
        setLocation={setLocation}
      />
    </>
  );
}

function LocationPair({
  label,
  warehouses,
  locations,
  warehouse,
  location,
  setWarehouse,
  setLocation,
}: {
  label: string;
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  warehouse: string;
  location: string;
  setWarehouse: (value: string) => void;
  setLocation: (value: string) => void;
}) {
  const filteredLocations = useMemo(
    () => locations.filter((item) => !warehouse || item.warehouse === warehouse),
    [locations, warehouse],
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label={`${label} warehouse`}>
        <NativeSelect
          value={warehouse}
          onChange={(event) => {
            setWarehouse(event.target.value);
            setLocation("");
          }}
          required
        >
          <option value="">Select warehouse</option>
          {warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
        </NativeSelect>
      </Field>
      <Field label={`${label} location`}>
        <NativeSelect value={location} onChange={(event) => setLocation(event.target.value)} required>
          <option value="">Select location</option>
          {filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
        </NativeSelect>
      </Field>
    </div>
  );
}
