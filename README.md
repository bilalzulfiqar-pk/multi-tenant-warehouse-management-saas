# Multi-Tenant Warehouse Management SaaS

Backend-first Django REST Framework portfolio project for a multi-tenant warehouse management SaaS.

The MVP follows `docs/architecture.md` as the source of truth. Phase 1 sets up only the backend foundation: Django, split settings, PostgreSQL, Redis, Celery, DRF, Swagger/OpenAPI docs, pytest, and a minimal custom email-based user model.

## Stack

- Django
- Django REST Framework
- PostgreSQL
- Redis
- Celery
- Docker Compose
- drf-spectacular
- pytest and pytest-django

## Local Setup

Copy the example environment file if you want to override the Docker defaults:

```powershell
Copy-Item .env.example .env
```

Build and start the services:

```powershell
docker compose build
docker compose up -d
```

Run Django checks and migrations:

```powershell
docker compose run --rm backend python manage.py check
docker compose run --rm backend python manage.py makemigrations accounts
docker compose run --rm backend python manage.py migrate
```

Run tests:

```powershell
docker compose run --rm backend pytest
```

Check Celery through Redis:

```powershell
docker compose exec backend python manage.py shell -c "from config.celery import celery_health_check; print(celery_health_check.delay().get(timeout=10))"
```

## API Documentation

With the backend service running:

- Swagger UI: `http://localhost:8000/api/docs/`
- OpenAPI schema: `http://localhost:8000/api/schema/`
- ReDoc: `http://localhost:8000/api/redoc/`

## Accounts API

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/token/refresh/`
- `GET /api/auth/me/`
- `PATCH /api/auth/me/`

## Local Subdomain Setup

Tenant context is resolved from the request subdomain. Local tenant URLs should use hosts like:

- `http://acme.localhost:8000/`
- `http://tenant1.localhost:8000/`
- `http://tenant2.localhost:8000/`

If your browser or OS does not resolve those automatically, add entries like these to your hosts file:

```text
127.0.0.1 acme.localhost
127.0.0.1 tenant1.localhost
127.0.0.1 tenant2.localhost
```

Alternative local wildcard-style domains can also be useful:

- `http://acme.lvh.me:8000/`
- `http://acme.localtest.me:8000/`

## MVP Boundaries

This project intentionally excludes Stripe, billing, AI, frontend work, receiving/dispatch workflows, email notifications, PDF reports, and CSV import/export from the MVP.
