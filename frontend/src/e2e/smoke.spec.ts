import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "strong-password-123";

type Workspace = {
  id: string;
  name: string;
  subdomain: string;
  role: string;
};

type SetupData = {
  warehouse: { id: string; code: string };
  destinationWarehouse: { id: string; code: string };
  location: { id: string; code: string };
  destinationLocation: { id: string; code: string };
  product: { id: string; sku: string };
};

function uniqueSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function appRequest<T>(
  page: Page,
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
  return page.evaluate(
    async ({ body, method, requestPath }) => {
      const response = await fetch(requestPath, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      return payload;
    },
    { body: init.body, method: init.method || "GET", requestPath: path },
  ) as Promise<T>;
}

async function register(page: Page, email: string, fullName: string, next?: string) {
  const path = next ? `/register?next=${encodeURIComponent(next)}` : "/register";
  const currentUrl = page.url();
  const origin = currentUrl.startsWith("http") ? new URL(currentUrl).origin : "";
  await page.goto(origin ? `${origin}${path}` : path);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Full name").fill(fullName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function logout(page: Page) {
  await appRequest(page, "/api/auth/logout", { method: "POST" });
}

async function createWorkspaceFromForm(page: Page, name: string, subdomain: string) {
  await expect(page.getByRole("heading", { name: "Workspaces", exact: true })).toBeVisible();
  await page.getByLabel("Company name").fill(name);
  await page.getByLabel("Subdomain").fill(subdomain);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function registerAndCreateWorkspace(page: Page) {
  const suffix = uniqueSuffix();
  const email = `owner-${suffix}@example.com`;
  const subdomain = `tenant-${suffix}`.replaceAll("-", "");

  await register(page, email, "Owner User");
  await createWorkspaceFromForm(page, `Tenant ${suffix}`, subdomain);

  return { email, subdomain, suffix };
}

async function createWorkspaceViaApi(page: Page, suffix: string) {
  return appRequest<Workspace>(page, "/api/global/workspaces/create", {
    method: "POST",
    body: {
      name: `Second Tenant ${suffix}`,
      subdomain: `second${suffix}`.replaceAll("-", "").slice(0, 32),
    },
  });
}

async function createSetupData(page: Page, suffix: string) {
  const code = suffix.replaceAll("-", "").slice(-8).toUpperCase();
  const sku = `SKU-${code}`;
  const warehouse = await appRequest<SetupData["warehouse"]>(page, "/api/tenant/warehouses", {
    method: "POST",
    body: {
      name: `Main Warehouse ${code}`,
      code: `WH${code.slice(-6)}`,
      city: "Karachi",
      country: "Pakistan",
    },
  });
  const destinationWarehouse = await appRequest<SetupData["destinationWarehouse"]>(
    page,
    "/api/tenant/warehouses",
    {
      method: "POST",
      body: {
        name: `Transfer Warehouse ${code}`,
        code: `TW${code.slice(-6)}`,
        city: "Lahore",
        country: "Pakistan",
      },
    },
  );
  const location = await appRequest<SetupData["location"]>(page, "/api/tenant/locations", {
    method: "POST",
    body: {
      warehouse: warehouse.id,
      name: "Aisle 1",
      code: "A1",
      location_type: "storage",
    },
  });
  const destinationLocation = await appRequest<SetupData["destinationLocation"]>(
    page,
    "/api/tenant/locations",
    {
      method: "POST",
      body: {
        warehouse: destinationWarehouse.id,
        name: "Dispatch 1",
        code: "D1",
        location_type: "storage",
      },
    },
  );
  const unit = await appRequest<{ id: string }>(page, "/api/tenant/units", {
    method: "POST",
    body: {
      name: `Each ${code}`,
      abbreviation: `EA${code.slice(-6)}`,
    },
  });
  const category = await appRequest<{ id: string }>(page, "/api/tenant/categories", {
    method: "POST",
    body: {
      name: `Category ${code}`,
      description: "Playwright category",
    },
  });
  const product = await appRequest<SetupData["product"]>(page, "/api/tenant/products", {
    method: "POST",
    body: {
      category: category.id,
      unit: unit.id,
      name: `Product ${code}`,
      sku,
      low_stock_threshold: "10.000",
      default_cost: "15.25",
    },
  });

  return { destinationLocation, destinationWarehouse, location, product, warehouse };
}

async function createInvite(page: Page, email: string, role: "staff" | "viewer") {
  const invite = await appRequest<{ invite_link: string }>(page, "/api/tenant/invites", {
    method: "POST",
    body: { email, role },
  });
  return new URL(invite.invite_link).searchParams.get("token") || "";
}

async function acceptInviteAsNewUser(page: Page, email: string, fullName: string, token: string) {
  await register(page, email, fullName, `/accept-invite?token=${token}`);
  await expect(page.getByRole("heading", { name: "Accept invite" })).toBeVisible();
  await page.getByRole("button", { name: "Accept invite" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("registration page renders", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
});

test("owner can create a workspace, run inventory workflows, and see audit logs", async ({ page }) => {
  test.setTimeout(120_000);
  const { suffix } = await registerAndCreateWorkspace(page);
  const setup = await createSetupData(page, suffix);

  await appRequest(page, "/api/tenant/inventory/stock-in", {
    method: "POST",
    body: {
      product: setup.product.id,
      warehouse: setup.warehouse.id,
      location: setup.location.id,
      quantity: "25.000",
      reason: "Playwright stock in",
    },
  });
  await appRequest(page, "/api/tenant/inventory/stock-out", {
    method: "POST",
    body: {
      product: setup.product.id,
      warehouse: setup.warehouse.id,
      location: setup.location.id,
      quantity: "5.000",
      reason: "Playwright stock out",
    },
  });
  await appRequest(page, "/api/tenant/inventory/adjust", {
    method: "POST",
    body: {
      product: setup.product.id,
      warehouse: setup.warehouse.id,
      location: setup.location.id,
      counted_quantity: "30.000",
      reason: "Playwright physical count",
    },
  });
  await appRequest(page, "/api/tenant/inventory/transfer", {
    method: "POST",
    body: {
      product: setup.product.id,
      source_warehouse: setup.warehouse.id,
      source_location: setup.location.id,
      destination_warehouse: setup.destinationWarehouse.id,
      destination_location: setup.destinationLocation.id,
      quantity: "7.000",
      reason: "Playwright transfer",
    },
  });

  await page.goto("/stock-levels");
  await page.getByPlaceholder("Search SKU, product, warehouse, or location").fill(setup.product.sku);
  await expect(page.getByRole("cell", { name: setup.product.sku, exact: true }).first()).toBeVisible();
  await expect(page.getByText("23.000")).toBeVisible();
  await expect(page.getByText("7.000")).toBeVisible();

  await page.goto("/stock-movements");
  await page.getByPlaceholder("Search product, SKU, reason, or reference").fill(setup.product.sku);
  await expect(page.getByText("Stock In", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Stock Out", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Adjustment", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Transfer In", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Transfer Out", { exact: true }).first()).toBeVisible();

  await page.goto("/audit-logs");
  await expect(page.getByRole("heading", { name: "Audit Logs" })).toBeVisible();
  await page.getByPlaceholder("Search action, resource, message, or actor").fill("stock");
  await expect(page.getByText("stock.stock_in").first()).toBeVisible();
  await expect(page.getByText("stock.stock_out").first()).toBeVisible();
  await expect(page.getByText("stock.adjusted").first()).toBeVisible();
  await expect(page.getByText("stock.transferred").first()).toBeVisible();
});

test("workspace switching moves to the selected tenant subdomain", async ({ page }) => {
  const { suffix } = await registerAndCreateWorkspace(page);
  const second = await createWorkspaceViaApi(page, suffix);

  await page.goto("/workspaces");
  await page.getByRole("button", { name: new RegExp(second.name) }).click();
  await expect(page).toHaveURL(new RegExp(`${second.subdomain}\\.lvh\\.me:3000/dashboard`));
});

test("staff and viewer invite flows keep role-aware inventory UI tight", async ({ page }) => {
  test.setTimeout(120_000);
  const { suffix } = await registerAndCreateWorkspace(page);
  const staffEmail = `staff-${suffix}@example.com`;
  const viewerEmail = `viewer-${suffix}@example.com`;
  const staffToken = await createInvite(page, staffEmail, "staff");
  const viewerToken = await createInvite(page, viewerEmail, "viewer");

  await logout(page);
  await acceptInviteAsNewUser(page, staffEmail, "Staff User", staffToken);
  await page.goto(`${new URL(page.url()).origin}/inventory-actions`);
  await expect(page.getByRole("tab", { name: /Stock In/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Stock Out/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Adjust/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Transfer/ })).toHaveCount(0);

  await logout(page);
  await acceptInviteAsNewUser(page, viewerEmail, "Viewer User", viewerToken);
  await expect(page.getByRole("link", { name: "Inventory Actions" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0);
  await page.goto(`${new URL(page.url()).origin}/inventory-actions`);
  await expect(page.getByText("Inventory actions are not available for Viewer access")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);

  await page.goto(`${new URL(page.url()).origin}/products`);
  await expect(page.getByRole("button", { name: "+ Product" })).toHaveCount(0);
});

test.describe("mobile responsiveness", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile shell remains usable across key screens", async ({ page }) => {
    test.setTimeout(120_000);
    const { suffix } = await registerAndCreateWorkspace(page);
    const setup = await createSetupData(page, suffix);
    const mobileNav = page.getByRole("banner").getByRole("navigation");

    await expect(mobileNav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Products" })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Stock Levels" })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Inventory Actions" })).toBeVisible();
    await expect(mobileNav.getByRole("button", { name: /More/ })).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total Products")).toBeVisible();

    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(page.getByText(setup.product.sku).first()).toBeVisible();

    await page.goto("/stock-levels");
    await expect(page.getByRole("heading", { name: "Stock Levels" })).toBeVisible();
    await page.getByPlaceholder("Search SKU, product, warehouse, or location").fill(setup.product.sku);
    await expect(page.getByRole("cell", { name: setup.product.sku, exact: true }).first()).toBeVisible();

    await page.goto("/inventory-actions");
    await expect(page.getByRole("heading", { name: "Inventory Actions" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Stock In/ })).toBeVisible();

    await mobileNav.getByRole("button", { name: /More/ }).click();
    await expect(page.getByRole("link", { name: "Team" })).toBeVisible();
    await page.getByRole("link", { name: "Team" }).click();
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();

    await page.goto("/workspaces");
    await expect(page.getByRole("heading", { name: "Workspaces", exact: true })).toBeVisible();
  });
});
