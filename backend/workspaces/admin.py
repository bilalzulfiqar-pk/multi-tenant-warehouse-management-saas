from django.contrib import admin

from .models import Workspace, WorkspaceInvite, WorkspaceMembership


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ("name", "subdomain", "status", "created_by", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "slug", "subdomain")
    ordering = ("name",)


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display = ("workspace", "user", "role", "status", "joined_at")
    list_filter = ("role", "status")
    search_fields = ("workspace__name", "user__email")
    autocomplete_fields = ("workspace", "user", "invited_by")


@admin.register(WorkspaceInvite)
class WorkspaceInviteAdmin(admin.ModelAdmin):
    list_display = ("workspace", "email", "role", "status", "expires_at")
    list_filter = ("role", "status")
    search_fields = ("workspace__name", "email", "token")
    autocomplete_fields = ("workspace", "invited_by", "accepted_by")
