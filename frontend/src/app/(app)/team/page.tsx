"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Copy, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/domain/confirm-action";
import { RoleBadge, StatusBadge } from "@/components/domain/badges";
import { Field } from "@/components/domain/field";
import { TableEmptyRow, TableErrorRow } from "@/components/domain/table-state";
import { EmptyState } from "@/components/layout/empty-state";
import { TableSkeleton } from "@/components/layout/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { createTenantResource, postTenantAction, useTenantArray } from "@/hooks/use-resource";
import { patchTenantResource } from "@/hooks/use-resource";
import { canManageMembers } from "@/lib/permissions";
import type { Invite, Membership, WorkspaceRole } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function TeamPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canManage = canManageMembers(session?.workspace?.role);
  const members = useTenantArray<Membership>("members", "members", canManage);
  const invites = useTenantArray<Invite>("invites", "invites", canManage);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberEdit, setMemberEdit] = useState<Membership | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["tenant"] });
  }

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createTenantResource("invites", {
        email: form.get("email"),
        role: form.get("role"),
      });
      setInviteOpen(false);
      toast.success("Invite created");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invite failed");
    }
  }

  async function updateMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberEdit) return;
    const form = new FormData(event.currentTarget);
    try {
      await patchTenantResource(`members/${memberEdit.id}`, {
        role: form.get("role"),
        status: form.get("status"),
      });
      setMemberEdit(null);
      toast.success("Member updated");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Member update failed");
    }
  }

  async function cancelInvite(invite: Invite) {
    try {
      await postTenantAction(`invites/${invite.id}/cancel`);
      toast.success("Invite cancelled");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel invite");
    }
  }

  async function disableMember(member: Membership) {
    try {
      await postTenantAction(`members/${member.id}/disable`);
      toast.success("Member disabled");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disable member");
    }
  }

  function frontendInviteLink(invite: Invite) {
    const token = new URL(invite.invite_link, window.location.href).searchParams.get("token");
    const url = new URL("/accept-invite", window.location.href);
    if (token) {
      url.searchParams.set("token", token);
    }
    return url.toString();
  }

  if (!canManage) {
    return (
      <div>
        <PageHeader
          title="Team"
          description="Manage workspace members and manual invite links."
        />
        <EmptyState
          title="Team management is not available for this role"
          description="Owners and Admins can manage members and invite links. Your other permitted workspace pages remain available."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage workspace members and manual invite links."
        actions={canManage ? <Button onClick={() => setInviteOpen(true)}>+ Invite member</Button> : null}
      />

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <TableSkeleton columns={5} />
                    </TableCell>
                  </TableRow>
                ) : members.isError ? (
                  <TableErrorRow colSpan={5} onRetry={() => members.refetch()} />
                ) : (members.data || []).length === 0 ? (
                  <TableEmptyRow
                    colSpan={5}
                    title="No members found"
                    description="Accepted members will appear here."
                  />
                ) : (members.data || []).map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="font-medium text-slate-950">{member.user.full_name || member.user.email}</p>
                      <p className="text-xs text-slate-500">{member.user.email}</p>
                    </TableCell>
                    <TableCell><RoleBadge role={member.role} /></TableCell>
                    <TableCell><StatusBadge value={member.status} /></TableCell>
                    <TableCell>{formatDateTime(member.joined_at)}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setMemberEdit(member)}>Edit</Button>
                          <ConfirmAction
                            title="Disable member?"
                            description={`${member.user.email} will lose access to this workspace.`}
                            confirmLabel="Disable"
                            onConfirm={() => disableMember(member)}
                          >
                            <Button variant="ghost" size="icon">
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </ConfirmAction>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="invites">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <TableSkeleton columns={5} />
                    </TableCell>
                  </TableRow>
                ) : invites.isError ? (
                  <TableErrorRow colSpan={5} onRetry={() => invites.refetch()} />
                ) : (invites.data || []).length === 0 ? (
                  <TableEmptyRow
                    colSpan={5}
                    title="No invites found"
                    description="Pending manual invite links will appear here."
                  />
                ) : (invites.data || []).map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell><RoleBadge role={invite.role as WorkspaceRole} /></TableCell>
                    <TableCell><StatusBadge value={invite.status} /></TableCell>
                    <TableCell>{formatDateTime(invite.expires_at)}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              navigator.clipboard.writeText(frontendInviteLink(invite));
                              toast.success("Invite link copied");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {invite.status === "pending" ? (
                            <ConfirmAction
                              title="Cancel invite?"
                              description={`The invite for ${invite.email} will no longer be usable.`}
                              confirmLabel="Cancel invite"
                              onConfirm={() => cancelInvite(invite)}
                            >
                              <Button variant="ghost" size="sm">Cancel</Button>
                            </ConfirmAction>
                          ) : null}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite member</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={createInvite}>
            <Field label="Email"><Input name="email" type="email" required /></Field>
            <Field label="Role">
              <NativeSelect name="role" defaultValue="staff">
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="viewer">Viewer</option>
              </NativeSelect>
            </Field>
            <Button type="submit">Create invite</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={memberEdit !== null} onOpenChange={(open) => !open && setMemberEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update member</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={updateMember}>
            <Field label="Role">
              <NativeSelect name="role" defaultValue={memberEdit?.role || "staff"}>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="viewer">Viewer</option>
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect name="status" defaultValue={memberEdit?.status || "active"}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </NativeSelect>
            </Field>
            <Button type="submit">Save member</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
