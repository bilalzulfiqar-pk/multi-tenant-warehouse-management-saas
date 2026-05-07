# Portfolio Summary

Use this document as a quick source for a project demo, resume bullets, and repository polish notes.

## One-Sentence Pitch

Backend-first Django REST Framework SaaS-style warehouse management API with subdomain-based multi-tenancy, JWT authentication, role-based workspace permissions, transaction-safe inventory workflows, audit logs, dashboard APIs, Swagger docs, and automated tests.

## Demo Script

1. Open Swagger at `http://localhost:8000/api/docs/`.
2. Register or login as a user.
3. Create a workspace on `localhost:8000`.
4. Switch requests to `acme.localhost:8000`.
5. Create a warehouse and location.
6. Create or use a unit of measure.
7. Create a category and product with a low stock threshold.
8. Run `stock-in`.
9. Run `stock-out`.
10. Run `adjust`.
11. Create a second location and run `transfer`.
12. Show stock levels and stock movements.
13. Show dashboard summary and low-stock endpoint.
14. Show audit logs.
15. Show tenant isolation by using a second workspace/subdomain.
16. Run `docker compose run --rm backend pytest`.

## Screenshot Checklist

Suggested screenshots for a GitHub README or portfolio page:

- Swagger UI at `/api/docs/`.
- OpenAPI schema at `/api/schema/`.
- Successful login response with tokens redacted.
- Workspace creation response.
- Tenant-scoped products list on `acme.localhost:8000`.
- Stock-in response showing stock movement.
- Dashboard summary response.
- Audit log list.
- Test suite passing in Docker.

Do not commit real secrets or full JWT values in screenshots.

## Resume Bullets

- Built a backend-first Django REST Framework SaaS API for warehouse management with JWT authentication, subdomain-based multi-tenancy, and shared-schema tenant isolation.
- Implemented workspace memberships and role-based permissions for Owner, Admin, Manager, Staff, and Viewer access patterns.
- Designed transaction-safe inventory workflows for stock in, stock out, counted adjustment, and warehouse transfer using database transactions and row locking.
- Modeled location-level stock tracking with append-only stock movements and audit logs for critical workspace, setup, and inventory events.
- Added tenant-scoped dashboard/reporting APIs, OpenAPI/Swagger documentation, pagination, filtering, search, and ordering.
- Dockerized local development with PostgreSQL, Redis, Celery, and pytest coverage for authentication, tenancy, permissions, inventory rules, transaction rollback, audit logs, and dashboard isolation.

## What This Project Demonstrates

- Practical Django app decomposition.
- Clean service-layer business logic for writes.
- Selector-style read logic for dashboard aggregation.
- Multi-tenant authorization beyond authentication.
- Transaction and rollback thinking for inventory correctness.
- API ergonomics for a future frontend.
- Test coverage focused on high-risk business rules.

## MVP Exclusions To Mention Clearly

The MVP intentionally does not include billing, Stripe, AI, a frontend dashboard, receiving workflows, dispatch workflows, supplier/customer modules, email notifications, PDF reports, or CSV import/export.

## Future Improvements

- React or Next.js frontend.
- Demo seed command and sample credentials.
- Screenshots or short demo GIF.
- Supplier/customer modules.
- Receiving and dispatch workflows.
- CSV/PDF exports.
- Email notifications via Celery.
- Advanced reporting.
- Billing and subscription management.
