"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Copy, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/domain/confirm-action";
import { RoleBadge, StatusBadge } from "@/components/domain/badges";
import { Field } from "@/components/domain/field";
import { MobileDataCard, MobileDataField } from "@/components/domain/mobile-data-card";
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
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);
  const [selectedInviteLink, setSelectedInviteLink] = useState("");
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

  function fallbackCopyText(text: string) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textArea);
    return copied;
  }

  async function copyInviteLink(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (!fallbackCopyText(text)) {
        throw new Error("Clipboard API unavailable");
      }
      toast.success("Invite link copied");
      return true;
    } catch {
      if (fallbackCopyText(text)) {
        toast.success("Invite link copied");
        return true;
      }
      toast.error("Could not copy automatically. Copy it manually from the dialog.");
      return false;
    }
  }

  function showInviteLink(invite: Invite) {
    setSelectedInviteLink(frontendInviteLink(invite));
    setInviteLinkOpen(true);
  }

  function canCopyInviteLink(invite: Invite) {
    return invite.status === "pending";
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
            <div className="space-y-3 p-4 md:hidden">
              {members.isLoading ? (
                <TableSkeleton columns={2} rows={4} />
              ) : members.isError ? (
                <div className="rounded-lg border bg-white">
                  <table className="w-full">
                    <tbody>
                      <TableErrorRow colSpan={1} onRetry={() => members.refetch()} />
                    </tbody>
                  </table>
                </div>
              ) : (members.data || []).length === 0 ? (
                <div className="rounded-lg border bg-white">
                  <table className="w-full">
                    <tbody>
                      <TableEmptyRow
                        colSpan={1}
                        title="No members found"
                        description="Accepted members will appear here."
                      />
                    </tbody>
                  </table>
                </div>
              ) : (members.data || []).map((member) => (
                <MobileDataCard
                  key={member.id}
                  title={member.user.full_name || member.user.email}
                  subtitle={member.user.email}
                  badge={<RoleBadge role={member.role} />}
                  actions={
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setMemberEdit(member)}>
                        Edit
                      </Button>
                      <ConfirmAction
                        title="Disable member?"
                        description={`${member.user.email} will lose access to this workspace.`}
                        confirmLabel="Disable"
                        onConfirm={() => disableMember(member)}
                      >
                        <Button variant="ghost" size="sm">
                          <UserMinus className="h-4 w-4" />
                          Disable
                        </Button>
                      </ConfirmAction>
                    </>
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MobileDataField label="Status" value={<StatusBadge value={member.status} />} />
                    <MobileDataField label="Joined" value={formatDateTime(member.joined_at)} />
                  </div>
                </MobileDataCard>
              ))}
            </div>
            <div className="hidden md:block">
            <Table className="min-w-[760px]">
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
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="invites">
          <Card>
            <div className="space-y-3 p-4 md:hidden">
              {invites.isLoading ? (
                <TableSkeleton columns={2} rows={4} />
              ) : invites.isError ? (
                <div className="rounded-lg border bg-white">
                  <table className="w-full">
                    <tbody>
                      <TableErrorRow colSpan={1} onRetry={() => invites.refetch()} />
                    </tbody>
                  </table>
                </div>
              ) : (invites.data || []).length === 0 ? (
                <div className="rounded-lg border bg-white">
                  <table className="w-full">
                    <tbody>
                      <TableEmptyRow
                        colSpan={1}
                        title="No invites found"
                        description="Pending manual invite links will appear here."
                      />
                    </tbody>
                  </table>
                </div>
              ) : (invites.data || []).map((invite) => (
                <MobileDataCard
                  key={invite.id}
                  title={invite.email}
                  subtitle={formatDateTime(invite.expires_at)}
                  badge={<RoleBadge role={invite.role as WorkspaceRole} />}
                  actions={
                    <>
                      {canCopyInviteLink(invite) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => showInviteLink(invite)}
                        >
                          <Copy className="h-4 w-4" />
                          Copy link
                        </Button>
                      ) : null}
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
                    </>
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MobileDataField label="Status" value={<StatusBadge value={invite.status} />} />
                    <MobileDataField label="Expires" value={formatDateTime(invite.expires_at)} />
                  </div>
                </MobileDataCard>
              ))}
            </div>
            <div className="hidden md:block">
            <Table className="min-w-[760px]">
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
                          {canCopyInviteLink(invite) ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => showInviteLink(invite)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          ) : null}
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
            </div>
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
            <Button className="w-full sm:w-auto" type="submit">Create invite</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteLinkOpen} onOpenChange={setInviteLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite link</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <p className="text-sm text-slate-600">
              Share this link with the invited user. The invited user can sign in with the invited email address and join this workspace from the invite page.
            </p>
            <Field label="Link">
              <Input
                readOnly
                value={selectedInviteLink}
                onFocus={(event) => event.currentTarget.select()}
              />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={async () => {
                  if (selectedInviteLink) {
                    await copyInviteLink(selectedInviteLink);
                  }
                }}
              >
                Copy link
              </Button>
            </div>
          </div>
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
            <Button className="w-full sm:w-auto" type="submit">Save member</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
