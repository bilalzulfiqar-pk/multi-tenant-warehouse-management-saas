"use client";

import { useState } from "react";

import { PaginationControls } from "@/components/domain/pagination";
import { MobileDataCard, MobileDataField } from "@/components/domain/mobile-data-card";
import { TableEmptyRow, TableErrorRow } from "@/components/domain/table-state";
import { TableSkeleton } from "@/components/layout/loading-state";
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
        <div className="space-y-3 p-4 md:hidden">
          {logs.isLoading ? (
            <TableSkeleton columns={2} rows={4} />
          ) : logs.isError ? (
            <div className="rounded-lg border bg-white">
              <table className="w-full">
                <tbody>
                  <TableErrorRow colSpan={1} onRetry={() => logs.refetch()} />
                </tbody>
              </table>
            </div>
          ) : (logs.data?.results || []).length === 0 ? (
            <div className="rounded-lg border bg-white">
              <table className="w-full">
                <tbody>
                  <TableEmptyRow
                    colSpan={1}
                    title="No audit events yet"
                    description="Important workspace, catalog, member, and stock actions will appear here."
                  />
                </tbody>
              </table>
            </div>
          ) : (logs.data?.results || []).map((log) => (
            <MobileDataCard
              key={log.id}
              title={log.action}
              subtitle={log.actor_email || "System"}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MobileDataField label="Timestamp" value={formatDateTime(log.created_at)} />
                <MobileDataField
                  label="Resource"
                  value={
                    <>
                      <p>{log.resource_type}</p>
                      <p className="truncate text-xs text-slate-500">{log.resource_id}</p>
                    </>
                  }
                />
                <MobileDataField label="Message" value={log.message || "-"} className="sm:col-span-2" />
                <MobileDataField
                  label="Metadata"
                  value={
                    <code className="line-clamp-3 text-xs text-slate-500">
                      {JSON.stringify(log.metadata)}
                    </code>
                  }
                  className="sm:col-span-2"
                />
              </div>
            </MobileDataCard>
          ))}
        </div>
        <div className="hidden md:block">
          <Table className="min-w-[920px]">
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
              {logs.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <TableSkeleton columns={6} />
                  </TableCell>
                </TableRow>
              ) : logs.isError ? (
                <TableErrorRow colSpan={6} onRetry={() => logs.refetch()} />
              ) : (logs.data?.results || []).length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  title="No audit events yet"
                  description="Important workspace, catalog, member, and stock actions will appear here."
                />
              ) : (logs.data?.results || []).map((log) => (
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
        </div>
        <PaginationControls page={page} setPage={setPage} data={logs.data} />
      </Card>
    </div>
  );
}
