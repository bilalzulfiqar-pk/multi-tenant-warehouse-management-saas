import { expect, test } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("registration page renders", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
});

test("user can create a workspace and stock in through tenant BFF", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const email = `owner-${suffix}@example.com`;
  const subdomain = `tenant-${suffix}`;
  const sku = `SKU-${suffix}`.toUpperCase();

  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Full name").fill("Owner User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("strong-password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Workspaces", exact: true })).toBeVisible();
  await page.getByLabel("Company name").fill(`Tenant ${suffix}`);
  await page.getByLabel("Subdomain").fill(subdomain);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const result = await page.evaluate(async ({ skuValue }) => {
    async function request(path: string, init?: RequestInit) {
      const response = await fetch(path, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init?.headers || {}),
        },
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(body));
      }
      return body;
    }

    const warehouse = await request("/api/tenant/warehouses", {
      method: "POST",
      body: JSON.stringify({
        name: "Main Warehouse",
        code: `WH${skuValue.slice(-4)}`,
        city: "Karachi",
        country: "Pakistan",
      }),
    });
    const location = await request("/api/tenant/locations", {
      method: "POST",
      body: JSON.stringify({
        warehouse: warehouse.id,
        name: "Aisle 1",
        code: "A1",
        location_type: "storage",
      }),
    });
    const units = await request("/api/tenant/units?page_size=100");
    const category = await request("/api/tenant/categories", {
      method: "POST",
      body: JSON.stringify({
        name: `Category ${skuValue}`,
        description: "Playwright category",
      }),
    });
    const product = await request("/api/tenant/products", {
      method: "POST",
      body: JSON.stringify({
        category: category.id,
        unit: units.results[0].id,
        name: `Product ${skuValue}`,
        sku: skuValue,
        low_stock_threshold: "10.000",
        default_cost: "15.25",
      }),
    });
    await request("/api/tenant/inventory/stock-in", {
      method: "POST",
      body: JSON.stringify({
        product: product.id,
        warehouse: warehouse.id,
        location: location.id,
        quantity: "25.000",
        reason: "Playwright stock in",
      }),
    });
    return product.sku;
  }, { skuValue: sku });

  await page.goto("/stock-levels");
  await page.getByPlaceholder("Search SKU, product, warehouse, or location").fill(result);
  await expect(page.getByRole("cell", { name: result, exact: true })).toBeVisible();
  await expect(page.getByText("25.000")).toBeVisible();
});
