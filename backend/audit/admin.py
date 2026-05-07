from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "resource_type", "resource_id", "workspace", "actor", "created_at")
    list_filter = ("action", "resource_type", "created_at")
    search_fields = ("action", "resource_type", "resource_id", "message", "workspace__name", "actor__email")
    autocomplete_fields = ("workspace", "actor")
    ordering = ("-created_at",)
