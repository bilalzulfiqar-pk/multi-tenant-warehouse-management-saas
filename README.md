# Multi-Tenant Warehouse Management SaaS

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-5-092E20?logo=django&logoColor=white)
![Django REST Framework](https://img.shields.io/badge/DRF-3.15-A30000?logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-5.5-37814A?logo=celery&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=0A0A0A)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green?logo=open-source-initiative&logoColor=white)

Full-stack warehouse management SaaS built with Django REST Framework and a tenant-aware Next.js frontend. The project demonstrates shared-schema multi-tenancy, JWT authentication, workspace roles and invites, warehouse and catalog setup, transaction-safe inventory operations, audit logs, dashboard APIs, and a responsive operations UI.

## What It Does

- Shared-schema multi-tenancy using workspace subdomains.
- Email-based authentication with JWT login, refresh, and profile endpoints.
- Workspace onboarding, role-based memberships, invites, invite acceptance, and workspace switching.
- Warehouse and location management with active or inactive lifecycle controls.
- Product categories, units, products, SKU rules, and low-stock thresholds.
- Transaction-safe stock in, stock out, adjustment, and transfer workflows.
- Append-only stock movement history and audit logs.
- Tenant-scoped dashboard summaries, low-stock alerts, and recent activity.
- Responsive Next.js frontend with HttpOnly cookies, a BFF proxy layer, role-aware UI, and invite-driven team onboarding.
- Swagger, OpenAPI schema, ReDoc, pytest coverage, and Dockerized local development.

## Architecture

The frontend talks to Next.js route handlers first, not directly to Django. Those handlers forward requests to the correct Django API host, while Django remains the source of truth for tenancy, permissions, and inventory business rules.

```mermaid
flowchart LR
    Browser["Browser<br/>tenant.lvh.me:3000"] --> Next["Next.js frontend + BFF"]
    Next --> Global["Global API routes"]
    Next --> Tenant["Tenant API routes"]
    Global --> Django["Django REST API"]
    Tenant --> Django
    Django --> Postgres["PostgreSQL"]
    Django --> Redis["Redis"]
    Redis --> Celery["Celery worker"]
```

Tenant context comes from the subdomain, but authorization still requires JWT authentication, active workspace membership, and role-based permission checks.

```mermaid
flowchart LR
    Host["pakmart.localhost:8000"] --> Middleware["TenantMiddleware"]
    Middleware --> Workspace["Resolve active workspace"]
    Workspace --> Auth["JWT authentication"]
    Auth --> Membership["Active membership check"]
    Membership --> Role["Role permission"]
    Role --> Queryset["Tenant-scoped query / service"]
    Queryset --> Response["JSON response"]
```

More implementation detail lives in [docs/architecture-summary.md](docs/architecture-summary.md) and [docs/api-examples.md](docs/api-examples.md).

## Tech Stack

- Backend: Python 3.11+, Django 5, Django REST Framework, SimpleJWT, django-filter, drf-spectacular, Celery
- Data and infra: PostgreSQL 16, Redis 7, Docker Compose
- Frontend: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, TanStack Query
- Testing: pytest, pytest-django, Vitest, Playwright

## Core Modules

- `accounts`: custom user model and auth APIs
- `workspaces`: workspaces, roles, invites, tenant middleware
- `warehouse`: warehouses and storage locations
- `catalog`: categories, units, products, SKU rules
- `inventory`: stock levels, movements, and mutation services
- `audit`: append-only audit logs
- `dashboard`: tenant-scoped reporting APIs
- `frontend`: responsive Next.js dashboard and BFF API layer

## Frontend Features

- Authentication, registration, and workspace onboarding flows
- Workspace switcher with tenant-subdomain routing
- Role-aware UI for Owner, Admin, Manager, Staff, and Viewer access levels
- Dashboard with tenant-scoped summary, low-stock, warehouse, and movement views
- Products, categories, units, warehouses, and locations management
- Stock levels, stock in, stock out, adjustment, and transfer workflows
- Team members, invite creation, invite acceptance, and audit log views
- Responsive admin shell for desktop, tablet, and mobile layouts

## Quick Start

### 1. Clone and enter the project

```powershell
git clone https://github.com/bilalzulfiqar-pk/multi-tenant-warehouse-management-saas.git
cd multi-tenant-warehouse-management-saas
```

### 2. Create local environment overrides

```powershell
Copy-Item .env.example .env
```

You can run with the defaults from `.env.example`, then adjust values later as needed.

### 3. Start the stack

```powershell
docker compose up -d --build
```

### 4. Run migrations

```powershell
docker compose run --rm backend python manage.py migrate
```

### 5. Seed demo data

```powershell
docker compose run --rm backend python manage.py seed_pakistan_demo
```

### 6. Open the app

```text
Frontend login: http://lvh.me:3000/login
Swagger UI:     http://localhost:8000/api/docs/
ReDoc:          http://localhost:8000/api/redoc/
OpenAPI schema: http://localhost:8000/api/schema/
```

Tenant dashboard examples after seeding:

```text
http://pakmart.lvh.me:3000/dashboard
http://punjabtraders.lvh.me:3000/dashboard
http://indussupplies.lvh.me:3000/dashboard
http://karachifoods.lvh.me:3000/dashboard
```

## Demo Data

The included `seed_pakistan_demo` command creates Pakistan-region sample data for realistic testing:

- multiple workspaces
- warehouses and warehouse locations
- catalog categories, units, and products
- stock levels and stock movements
- audit log history
- memberships and pending invites

Shared demo password:

```text
PakistanDemo123!
```

Main demo users:

| Email | Access |
|---|---|
| `owner@pakdemo.example.com` | Owner across `pakmart`, `punjabtraders`, `indussupplies` |
| `admin@pakdemo.example.com` | Admin |
| `manager@pakdemo.example.com` | Manager |
| `staff@pakdemo.example.com` | Staff |
| `viewer@pakdemo.example.com` | Viewer |
| `nadia@pakdemo.example.com` | Limited user with `pakmart` and `karachifoods` |

## Environment Variables

Copy from `.env.example`. Docker Compose already provides local defaults, but these are the project variables that matter:

| Variable | Description | Example |
|---|---|---|
| `DJANGO_SECRET_KEY` | Django secret key for signing sessions and tokens | `change-me` |
| `DJANGO_DEBUG` | Enable Django debug mode locally | `True` |
| `DJANGO_ALLOWED_HOSTS` | Allowed backend hosts and wildcard local domains | `localhost,127.0.0.1,backend,.localhost,.lvh.me,.localtest.me` |
| `POSTGRES_DB` | PostgreSQL database name | `warehouse_saas` |
| `POSTGRES_USER` | PostgreSQL username | `warehouse_user` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `warehouse_password` |
| `POSTGRES_HOST` | PostgreSQL host used by Django and Docker | `postgres` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `DATABASE_URL` | Full Django database connection string | `postgres://warehouse_user:warehouse_password@postgres:5432/warehouse_saas` |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379/0` |
| `CELERY_BROKER_URL` | Celery broker URL | `redis://redis:6379/0` |
| `CELERY_RESULT_BACKEND` | Celery result backend URL | `redis://redis:6379/0` |
| `BACKEND_INTERNAL_ORIGIN` | Next.js server-side origin for Django API calls | `http://backend:8000` |
| `TENANT_BACKEND_HOST_SUFFIX` | Tenant host suffix used by the frontend BFF | `lvh.me:8000` |
| `FRONTEND_COOKIE_DOMAIN` | Shared local cookie domain for workspace subdomains | `lvh.me` |
| `FRONTEND_BASE_DOMAIN` | Local frontend base domain | `lvh.me` |
| `NEXT_PUBLIC_FRONTEND_BASE_DOMAIN` | Public frontend base domain used in browser redirects | `lvh.me` |
| `NEXT_PUBLIC_APP_NAME` | Frontend app display name | `Multi-Tenant WMS` |

## Local Usage Notes

- Use `lvh.me` for frontend testing so cookies can be shared across workspace subdomains.
- Root and auth APIs are easiest to test from `localhost:8000`.
- Tenant APIs should be tested from a tenant host. For consistency with the frontend local setup, prefer `lvh.me`-based hosts such as `pakmart.lvh.me:8000`.

Examples:

```text
http://localhost:8000/api/docs/
http://pakmart.lvh.me:8000/api/products/
http://lvh.me:3000/login
http://pakmart.lvh.me:3000/dashboard
```

## Verification

Backend checks:

```powershell
docker compose run --rm backend python manage.py check
docker compose run --rm backend pytest
docker compose exec backend python manage.py shell -c "from config.celery import celery_health_check; print(celery_health_check.delay().get(timeout=10))"
```

Frontend checks:

```powershell
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Playwright smoke tests can also be run locally from `frontend/`:

```powershell
npm run e2e
```

## API Coverage

Major API areas in the current project:

- Auth: register, login, refresh, current user profile
- Workspaces: create, list, current workspace settings
- Team: memberships, invite create, invite accept, disable member
- Warehouse: warehouses and locations
- Catalog: categories, units, products
- Inventory: stock levels, stock movements, stock in, stock out, adjust, transfer
- Audit: audit log list and detail
- Dashboard: summary, low stock, inventory by warehouse, recent movements

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
