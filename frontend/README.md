# Multi-Tenant WMS Frontend

Next.js TypeScript dashboard for the Django multi-tenant warehouse API.

## Local Development

Run the backend first from the repository root:

```powershell
docker compose up -d backend postgres redis celery
```

Run the frontend locally:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Docker Development

From the repository root:

```powershell
docker compose up -d
```

The frontend runs at `http://localhost:3000` and forwards API calls through Next route handlers to the Django backend.

## Environment

Useful environment variables:

- `BACKEND_INTERNAL_ORIGIN`: where the Next BFF reaches Django. Local default: `http://localhost:8000`; Docker default: `http://backend:8000`.
- `TENANT_BACKEND_HOST_SUFFIX`: host suffix used for tenant-aware Django requests. Default: `localhost:8000`.
- `NEXT_PUBLIC_APP_NAME`: display name. Default: `Multi-Tenant WMS`.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Frontend Scope

Implemented screens cover authentication, workspace selection, dashboard, products/categories/units, warehouses/locations, read-only stock levels, inventory action workflows, stock movements, team invites, audit logs, and workspace settings.
