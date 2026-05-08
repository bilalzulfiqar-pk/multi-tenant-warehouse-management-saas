"use client";

import { useState } from "react";

import { PaginationControls } from "@/components/domain/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { useTenantList } from "@/hooks/use-resource";
import { canViewAuditLogs } from "@/lib/permissions";
import type { AuditLog } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function AuditLogsPage() {
  const { data: session } = useSession();
  const allowed = canViewAuditLogs(session?.workspace?.role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const logs = useTenantList<AuditLog>("audit-logs", "audit-logs", {
    page,
    search,
    ordering: "-created_at",
  });

  if (!allowed) {
    return (
      <Alert variant="warning">
        Audit logs are available only to Owners, Admins, and Managers.
      </Alert>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Read-only history for important workspace, setup, member, and stock events."
      />
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search action, resource, message, or actor"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
        </CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(logs.data?.results || []).map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatDateTime(log.created_at)}</TableCell>
                <TableCell>{log.actor_email || "System"}</TableCell>
                <TableCell className="font-medium text-slate-950">{log.action}</TableCell>
                <TableCell>
                  <p>{log.resource_type}</p>
                  <p className="max-w-40 truncate text-xs text-slate-500">{log.resource_id}</p>
                </TableCell>
                <TableCell>{log.message || "-"}</TableCell>
                <TableCell>
                  <code className="line-clamp-2 text-xs text-slate-500">
                    {JSON.stringify(log.metadata)}
                  </code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls page={page} setPage={setPage} data={logs.data} />
      </Card>
    </div>
  );
}
