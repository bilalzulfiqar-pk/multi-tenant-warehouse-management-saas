# API Examples

These examples assume the Docker stack is running and the API is available on port `8000`.

Use `localhost:8000` for global/root APIs. Use a tenant subdomain such as `acme.localhost:8000` for tenant-owned APIs.

## Register A User

```powershell
curl -X POST http://localhost:8000/api/auth/register/ `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"owner@example.com\",\"full_name\":\"Owner User\",\"password\":\"strong-password-123\"}"
```

## Login

```powershell
curl -X POST http://localhost:8000/api/auth/login/ `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"owner@example.com\",\"password\":\"strong-password-123\"}"
```

The response includes `access`, `refresh`, and `user`. In the examples below, replace `<ACCESS_TOKEN>` with the returned access token.

## Create Workspace

```powershell
curl -X POST http://localhost:8000/api/workspaces/create/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"name\":\"Acme Logistics\",\"subdomain\":\"acme\"}"
```

After this, tenant APIs should use:

```text
http://acme.localhost:8000
```

## View Current Tenant Workspace

```powershell
curl http://acme.localhost:8000/api/workspace/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Create Warehouse

```powershell
curl -X POST http://acme.localhost:8000/api/warehouses/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"name\":\"Main Warehouse\",\"code\":\"MAIN\",\"city\":\"Karachi\",\"country\":\"Pakistan\"}"
```

Save the returned warehouse `id` as `<WAREHOUSE_ID>`.

## Create Location

```powershell
curl -X POST http://acme.localhost:8000/api/locations/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"warehouse\":\"<WAREHOUSE_ID>\",\"name\":\"Aisle 1\",\"code\":\"A1\",\"location_type\":\"storage\"}"
```

Save the returned location `id` as `<LOCATION_ID>`.

## Create Unit Of Measure

Workspace creation seeds common units in the current implementation, but this endpoint can create more.

```powershell
curl -X POST http://acme.localhost:8000/api/units/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"name\":\"Pallet\",\"abbreviation\":\"plt\"}"
```

Save a unit `id` as `<UNIT_ID>`.

## Create Category

```powershell
curl -X POST http://acme.localhost:8000/api/categories/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"name\":\"Raw Materials\",\"description\":\"Warehouse raw materials\"}"
```

Save the returned category `id` as `<CATEGORY_ID>`.

## Create Product

```powershell
curl -X POST http://acme.localhost:8000/api/products/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"category\":\"<CATEGORY_ID>\",\"unit\":\"<UNIT_ID>\",\"name\":\"Rice Bag\",\"sku\":\"RICE-25KG\",\"low_stock_threshold\":\"10.000\",\"default_cost\":\"15.25\"}"
```

Save the returned product `id` as `<PRODUCT_ID>`.

## Stock In

```powershell
curl -X POST http://acme.localhost:8000/api/inventory/stock-in/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"product\":\"<PRODUCT_ID>\",\"warehouse\":\"<WAREHOUSE_ID>\",\"location\":\"<LOCATION_ID>\",\"quantity\":\"25.000\",\"reason\":\"Initial stock\"}"
```

## Stock Out

```powershell
curl -X POST http://acme.localhost:8000/api/inventory/stock-out/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"product\":\"<PRODUCT_ID>\",\"warehouse\":\"<WAREHOUSE_ID>\",\"location\":\"<LOCATION_ID>\",\"quantity\":\"3.000\",\"reason\":\"Customer dispatch placeholder\"}"
```

Dispatch workflows are outside the MVP, so `stock-out` is a direct inventory operation.

## Adjust Stock

```powershell
curl -X POST http://acme.localhost:8000/api/inventory/adjust/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"product\":\"<PRODUCT_ID>\",\"warehouse\":\"<WAREHOUSE_ID>\",\"location\":\"<LOCATION_ID>\",\"counted_quantity\":\"20.000\",\"reason\":\"Physical count correction\"}"
```

## Transfer Stock

Create another location first and save it as `<DESTINATION_LOCATION_ID>`.

```powershell
curl -X POST http://acme.localhost:8000/api/inventory/transfer/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"product\":\"<PRODUCT_ID>\",\"source_warehouse\":\"<WAREHOUSE_ID>\",\"source_location\":\"<LOCATION_ID>\",\"destination_warehouse\":\"<WAREHOUSE_ID>\",\"destination_location\":\"<DESTINATION_LOCATION_ID>\",\"quantity\":\"5.000\",\"reason\":\"Move to second aisle\"}"
```

## Read Stock Levels

```powershell
curl "http://acme.localhost:8000/api/stock-levels/?product=<PRODUCT_ID>&page_size=20" `
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Read Stock Movements

```powershell
curl "http://acme.localhost:8000/api/stock-movements/?movement_type=stock_in&ordering=-created_at&page_size=20" `
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Dashboard Summary

```powershell
curl http://acme.localhost:8000/api/dashboard/summary/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Other dashboard endpoints:

```text
GET /api/dashboard/low-stock/
GET /api/dashboard/inventory-by-warehouse/
GET /api/dashboard/recent-movements/
```

## Invite A Member

Owner/Admin only:

```powershell
curl -X POST http://acme.localhost:8000/api/invites/ `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"staff@example.com\",\"role\":\"staff\"}"
```

The response includes `invite_link`. The invited user must already have an account or register one with the same email, then accept the token from the tenant host:

```powershell
curl -X POST http://acme.localhost:8000/api/invites/accept/ `
  -H "Authorization: Bearer <INVITED_USER_ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d "{\"token\":\"<INVITE_TOKEN>\"}"
```

## Audit Logs

Owner/Admin/Manager only:

```powershell
curl "http://acme.localhost:8000/api/audit-logs/?action=stock.stock_in&page_size=20" `
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Business Error Shape

Custom business-rule errors use this envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Insufficient stock for this operation.",
    "details": {}
  }
}
```

## API Docs

```text
http://localhost:8000/api/docs/
http://localhost:8000/api/schema/
http://localhost:8000/api/redoc/
```
