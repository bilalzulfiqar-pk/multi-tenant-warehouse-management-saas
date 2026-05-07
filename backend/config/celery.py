"""
Celery configuration for lightweight MVP background task support.
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("warehouse_saas")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(name="celery_health_check")
def celery_health_check():
    return "ok"
