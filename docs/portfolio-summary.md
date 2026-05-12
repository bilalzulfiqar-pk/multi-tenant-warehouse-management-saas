# Portfolio Summary

Use this document as a quick source for a project demo, resume bullets, and repository polish notes.

## One-Sentence Pitch

Backend-first Django REST Framework warehouse management SaaS with subdomain-based multi-tenancy, transaction-safe inventory workflows, audit logs, Swagger docs, automated tests, and a role-aware Next.js dashboard.

## Demo Script

1. Start Docker with `docker compose up -d`.
2. Seed demo data with `docker compose run --rm backend python manage.py seed_pakistan_demo`.
3. Open the frontend login page at `http://lvh.me:3000/login`.
4. Login as `owner@pakdemo.example.com` with password `PakistanDemo123!`.
5. Show the workspace switcher for `pakmart`, `punjabtraders`, and `indussupplies`.
6. Open a tenant dashboard such as `http://pakmart.lvh.me:3000/dashboard`.
7. Show warehouses, locations, categories, units, and products.
8. Run a stock-in, stock-out, adjustment, or transfer through the UI.
9. Show stock levels, stock movements, dashboard cards, and audit logs.
10. Login as `nadia@pakdemo.example.com` to show a different workspace list.
11. Open Swagger at `http://localhost:8000/api/docs/`.
12. Show tenant-scoped API behavior using `pakmart.localhost:8000`.
13. Run `docker compose run --rm backend pytest`.
14. Run frontend checks with `cd frontend`, then `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## Screenshot Checklist

Suggested screenshots for a GitHub README or portfolio page:

- Frontend login screen at `http://lvh.me:3000/login`.
- Workspace switcher showing multiple tenant workspaces.
- Tenant dashboard at `http://pakmart.lvh.me:3000/dashboard`.
- Product/catalog list with Pakistan demo items.
- Inventory action form after a successful stock operation.
- Stock levels and stock movements pages.
- Audit log page.
- Swagger UI at `/api/docs/`.
- OpenAPI schema at `/api/schema/`.
- Backend and frontend test commands passing.

Do not commit real secrets or full JWT values in screenshots.

## Resume Bullets

- Built a backend-first Django REST Framework SaaS API for warehouse management with JWT authentication, subdomain-based multi-tenancy, and shared-schema tenant isolation.
- Implemented workspace memberships and role-based permissions for Owner, Admin, Manager, Staff, and Viewer access patterns.
- Designed transaction-safe inventory workflows for stock in, stock out, counted adjustment, and warehouse transfer using database transactions and row locking.
- Modeled location-level stock tracking with append-only stock movements and audit logs for critical workspace, setup, and inventory events.
- Added tenant-scoped dashboard/reporting APIs, OpenAPI/Swagger documentation, pagination, filtering, search, and ordering.
- Dockerized local development with PostgreSQL, Redis, Celery, and pytest coverage for authentication, tenancy, permissions, inventory rules, transaction rollback, audit logs, and dashboard isolation.
- Built a Next.js dashboard with tenant-aware routing, role-aware navigation, HttpOnly JWT cookies, and a BFF layer that proxies requests to the Django API.

## What This Project Demonstrates

- Practical Django app decomposition.
- Clean service-layer business logic for writes.
- Selector-style read logic for dashboard aggregation.
- Multi-tenant authorization beyond authentication.
- Transaction and rollback thinking for inventory correctness.
- API ergonomics for a future frontend.
- Frontend integration with tenant subdomains and secure cookie-based session handling.
- Test coverage focused on high-risk business rules.

## MVP Exclusions To Mention Clearly

The original MVP was backend-first and intentionally avoided relying on frontend work. The current project now includes a Next.js dashboard, while still excluding billing, Stripe, AI, receiving workflows, dispatch workflows, supplier/customer modules, email notifications, PDF reports, and CSV import/export.

## Future Improvements

- Screenshots or short demo GIF.
- Dedicated Docker/CI e2e test service.
- Polished OpenAPI examples for every inventory action.
- Supplier/customer modules.
- Receiving and dispatch workflows.
- CSV/PDF exports.
- Email notifications via Celery.
- Advanced reporting.
- Billing and subscription management.
