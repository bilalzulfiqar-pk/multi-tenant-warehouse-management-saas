from .base import *

SECRET_KEY = "test-secret-key-for-jwt-signing-at-least-32-bytes"
DEBUG = False
ALLOWED_HOSTS = [
    "testserver",
    "localhost",
    "127.0.0.1",
    ".localhost",
    ".lvh.me",
    ".localtest.me",
]

test_database_url = env(
    "TEST_DATABASE_URL",
    default=env("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'test.sqlite3'}"),
)
DATABASES = {"default": env.db_url_config(test_database_url)}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
